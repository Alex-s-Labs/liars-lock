import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { updateEloForMatch } from "./elo";

const PHASE_TIMEOUT_MS = 60 * 1000; // 60 seconds

// Get match by ID
export const get = query({
  args: {
    matchId: v.id("matches"),
    agentId: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) {
      return null;
    }

    const player1 = await ctx.db.get(match.player1);
    const player2 = await ctx.db.get(match.player2);

    if (!player1 || !player2) {
      throw new Error("Players not found");
    }

    // Determine if requester is a player
    const isPlayer1 = args.agentId === match.player1;
    const isPlayer2 = args.agentId === match.player2;

    // Public info always visible
    const result: any = {
      _id: match._id,
      player1: { _id: player1._id, name: player1.name, elo: player1.elo },
      player2: { _id: player2._id, name: player2.name, elo: player2.elo },
      status: match.status,
      createdAt: match.createdAt,
      completedAt: match.completedAt,
    };

    if (match.status === "play") {
      // During play phase: show whether each side has played (no details)
      result.player1Played = match.player1Choice !== undefined;
      result.player2Played = match.player2Choice !== undefined;
    }

    if (match.status === "guess") {
      // During guess phase: show opponent's claim + message (but NOT choice)
      // Also show who has guessed
      result.player1Claim = match.player1Claim;
      result.player2Claim = match.player2Claim;
      result.player1Message = match.player1Message;
      result.player2Message = match.player2Message;
      result.player1Guessed = match.player1Guess !== undefined;
      result.player2Guessed = match.player2Guess !== undefined;
    }

    if (match.status === "complete" || match.status === "forfeit") {
      // Show everything
      result.player1Choice = match.player1Choice;
      result.player2Choice = match.player2Choice;
      result.player1Claim = match.player1Claim;
      result.player2Claim = match.player2Claim;
      result.player1Message = match.player1Message;
      result.player2Message = match.player2Message;
      result.player1Guess = match.player1Guess;
      result.player2Guess = match.player2Guess;
      result.winner = match.winner;
      result.player1EloChange = match.player1EloChange;
      result.player2EloChange = match.player2EloChange;
    }

    return result;
  },
});

// Submit play: choice (hidden) + claim (visible) + optional message
export const play = mutation({
  args: {
    matchId: v.id("matches"),
    agentId: v.id("agents"),
    choice: v.number(),
    claim: v.number(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) {
      throw new Error("Match not found");
    }

    if (match.status !== "play") {
      throw new Error("Not in play phase");
    }

    // Check timeout
    if (Date.now() > match.phaseDeadline) {
      await ctx.db.patch(match._id, { status: "forfeit" });
      throw new Error("Phase timeout");
    }

    const isPlayer1 = args.agentId === match.player1;
    const isPlayer2 = args.agentId === match.player2;

    if (!isPlayer1 && !isPlayer2) {
      throw new Error("Not a player in this match");
    }

    // Validate choice and claim (must be 0 or 1)
    if (args.choice !== 0 && args.choice !== 1) {
      throw new Error("Choice must be 0 or 1");
    }
    if (args.claim !== 0 && args.claim !== 1) {
      throw new Error("Claim must be 0 or 1");
    }

    // Validate message length
    if (args.message && args.message.length > 500) {
      throw new Error("Message too long (max 500 chars)");
    }

    // Update fields
    if (isPlayer1) {
      if (match.player1Choice !== undefined) {
        throw new Error("Already played");
      }
      await ctx.db.patch(match._id, {
        player1Choice: args.choice,
        player1Claim: args.claim,
        player1Message: args.message,
      });
    } else {
      if (match.player2Choice !== undefined) {
        throw new Error("Already played");
      }
      await ctx.db.patch(match._id, {
        player2Choice: args.choice,
        player2Claim: args.claim,
        player2Message: args.message,
      });
    }

    // Check if both played → advance to guess
    const updated = await ctx.db.get(args.matchId);
    if (updated!.player1Choice !== undefined && updated!.player2Choice !== undefined) {
      await ctx.db.patch(match._id, {
        status: "guess",
        phaseDeadline: Date.now() + PHASE_TIMEOUT_MS,
      });
    }

    return { success: true };
  },
});

// Submit guess
export const guess = mutation({
  args: {
    matchId: v.id("matches"),
    agentId: v.id("agents"),
    guess: v.number(),
  },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) {
      throw new Error("Match not found");
    }

    if (match.status !== "guess") {
      throw new Error("Not in guess phase");
    }

    // Check timeout
    if (Date.now() > match.phaseDeadline) {
      await ctx.db.patch(match._id, { status: "forfeit" });
      throw new Error("Phase timeout");
    }

    const isPlayer1 = args.agentId === match.player1;
    const isPlayer2 = args.agentId === match.player2;

    if (!isPlayer1 && !isPlayer2) {
      throw new Error("Not a player in this match");
    }

    // Validate guess (must be 0 or 1)
    if (args.guess !== 0 && args.guess !== 1) {
      throw new Error("Guess must be 0 or 1");
    }

    // Update guess
    if (isPlayer1) {
      if (match.player1Guess !== undefined) {
        throw new Error("Already guessed");
      }
      await ctx.db.patch(match._id, { player1Guess: args.guess });
    } else {
      if (match.player2Guess !== undefined) {
        throw new Error("Already guessed");
      }
      await ctx.db.patch(match._id, { player2Guess: args.guess });
    }

    // Check if both guessed → resolve immediately
    const updated = await ctx.db.get(args.matchId);
    if (updated!.player1Guess !== undefined && updated!.player2Guess !== undefined) {
      // Resolve match
      const p1GuessCorrect = updated!.player1Guess === updated!.player2Choice;
      const p2GuessCorrect = updated!.player2Guess === updated!.player1Choice;

      let winner: typeof match.winner;
      if (p1GuessCorrect && !p2GuessCorrect) {
        winner = match.player1;
      } else if (p2GuessCorrect && !p1GuessCorrect) {
        winner = match.player2;
      } else {
        winner = "draw";
      }

      const now = Date.now();

      await ctx.db.patch(match._id, {
        status: "complete",
        winner,
        completedAt: now,
      });

      // Update lastPlayedAt for both players
      const player1 = await ctx.db.get(match.player1);
      const player2 = await ctx.db.get(match.player2);

      if (player1) {
        await ctx.db.patch(match.player1, { lastPlayedAt: now });
      }
      if (player2) {
        await ctx.db.patch(match.player2, { lastPlayedAt: now });
      }

      // Update Elo
      await updateEloForMatch(ctx, args.matchId);
    }

    return { success: true };
  },
});

// Check for timeouts and forfeit if deadline passed
export const checkTimeout = mutation({
  args: {
    matchId: v.id("matches"),
  },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) {
      throw new Error("Match not found");
    }

    if (match.status === "complete" || match.status === "forfeit") {
      return { status: match.status };
    }

    // Check if deadline passed
    if (Date.now() > match.phaseDeadline) {
      let winner: typeof match.winner = "draw";

      if (match.status === "play") {
        if (match.player1Choice === undefined && match.player2Choice !== undefined) {
          winner = match.player2;
        } else if (match.player1Choice !== undefined && match.player2Choice === undefined) {
          winner = match.player1;
        }
      } else if (match.status === "guess") {
        if (match.player1Guess === undefined && match.player2Guess !== undefined) {
          winner = match.player2;
        } else if (match.player1Guess !== undefined && match.player2Guess === undefined) {
          winner = match.player1;
        }
      }

      const now = Date.now();

      await ctx.db.patch(match._id, {
        status: "forfeit",
        winner,
        completedAt: now,
      });

      // Update lastPlayedAt for both players
      const player1 = await ctx.db.get(match.player1);
      const player2 = await ctx.db.get(match.player2);

      if (player1) {
        await ctx.db.patch(match.player1, { lastPlayedAt: now });
      }
      if (player2) {
        await ctx.db.patch(match.player2, { lastPlayedAt: now });
      }

      // Update Elo if there was a winner
      if (winner !== "draw") {
        await updateEloForMatch(ctx, args.matchId);
      }

      return { status: "forfeit", winner };
    }

    return { status: match.status };
  },
});
