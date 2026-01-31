import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { updateEloForMatch } from "./elo";

const PHASE_TIMEOUT_MS = 60 * 1000; // 60 seconds

// Hash a string using SHA-256
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

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

    // Public info always visible
    const result: any = {
      _id: match._id,
      player1: { _id: player1._id, name: player1.name, elo: player1.elo },
      player2: { _id: player2._id, name: player2.name, elo: player2.elo },
      status: match.status,
      createdAt: match.createdAt,
      completedAt: match.completedAt,
    };

    // Determine if requester is a player
    const isPlayer1 = args.agentId === match.player1;
    const isPlayer2 = args.agentId === match.player2;
    const isPlayer = isPlayer1 || isPlayer2;

    // Show messages if both submitted (message phase complete)
    if (match.player1Message && match.player2Message) {
      result.player1Message = match.player1Message;
      result.player2Message = match.player2Message;
    }

    // Show reveals if complete
    if (match.status === "complete" || match.status === "forfeit") {
      result.player1Choice = match.player1Choice;
      result.player2Choice = match.player2Choice;
      result.player1Guess = match.player1Guess;
      result.player2Guess = match.player2Guess;
      result.winner = match.winner;
      result.player1EloChange = match.player1EloChange;
      result.player2EloChange = match.player2EloChange;
    }

    // Show your own commit status if you're a player
    if (isPlayer) {
      result.myCommitStatus = isPlayer1 ? !!match.player1Commit : !!match.player2Commit;
      result.opponentCommitStatus = isPlayer1 ? !!match.player2Commit : !!match.player1Commit;
    }

    return result;
  },
});

// Submit commitment
export const commit = mutation({
  args: {
    matchId: v.id("matches"),
    agentId: v.id("agents"),
    hash: v.string(),
  },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) {
      throw new Error("Match not found");
    }

    if (match.status !== "commit") {
      throw new Error("Not in commit phase");
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

    // Update commitment
    if (isPlayer1) {
      if (match.player1Commit) {
        throw new Error("Already committed");
      }
      await ctx.db.patch(match._id, { player1Commit: args.hash });
    } else {
      if (match.player2Commit) {
        throw new Error("Already committed");
      }
      await ctx.db.patch(match._id, { player2Commit: args.hash });
    }

    // Check if both committed
    const updated = await ctx.db.get(args.matchId);
    if (updated!.player1Commit && updated!.player2Commit) {
      // Advance to message phase
      await ctx.db.patch(match._id, {
        status: "message",
        phaseDeadline: Date.now() + PHASE_TIMEOUT_MS,
      });
    }

    return { success: true };
  },
});

// Submit message
export const message = mutation({
  args: {
    matchId: v.id("matches"),
    agentId: v.id("agents"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) {
      throw new Error("Match not found");
    }

    if (match.status !== "message") {
      throw new Error("Not in message phase");
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

    // Validate message length
    if (args.message.length > 500) {
      throw new Error("Message too long (max 500 chars)");
    }

    // Update message
    if (isPlayer1) {
      if (match.player1Message) {
        throw new Error("Already sent message");
      }
      await ctx.db.patch(match._id, { player1Message: args.message });
    } else {
      if (match.player2Message) {
        throw new Error("Already sent message");
      }
      await ctx.db.patch(match._id, { player2Message: args.message });
    }

    // Check if both sent messages
    const updated = await ctx.db.get(args.matchId);
    if (updated!.player1Message && updated!.player2Message) {
      // Advance to guess phase
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

    // Check if both guessed
    const updated = await ctx.db.get(args.matchId);
    if (updated!.player1Guess !== undefined && updated!.player2Guess !== undefined) {
      // Advance to reveal phase
      await ctx.db.patch(match._id, {
        status: "reveal",
        phaseDeadline: Date.now() + PHASE_TIMEOUT_MS,
      });
    }

    return { success: true };
  },
});

// Reveal choice and nonce
export const reveal = mutation({
  args: {
    matchId: v.id("matches"),
    agentId: v.id("agents"),
    choice: v.number(),
    nonce: v.string(),
  },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) {
      throw new Error("Match not found");
    }

    if (match.status !== "reveal") {
      throw new Error("Not in reveal phase");
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

    // Validate choice (must be 0 or 1)
    if (args.choice !== 0 && args.choice !== 1) {
      throw new Error("Choice must be 0 or 1");
    }

    // Verify hash
    const expectedHash = await sha256(`${args.choice}:${args.nonce}`);
    const actualHash = isPlayer1 ? match.player1Commit : match.player2Commit;

    if (expectedHash !== actualHash) {
      // Cheater! They lose automatically
      const winner = isPlayer1 ? match.player2 : match.player1;
      await ctx.db.patch(match._id, {
        status: "complete",
        winner,
        completedAt: Date.now(),
      });
      await updateEloForMatch(ctx, args.matchId);
      return { success: false, error: "Hash verification failed - you cheated and lost" };
    }

    // Update reveal
    if (isPlayer1) {
      if (match.player1Choice !== undefined) {
        throw new Error("Already revealed");
      }
      await ctx.db.patch(match._id, {
        player1Choice: args.choice,
        player1Nonce: args.nonce,
      });
    } else {
      if (match.player2Choice !== undefined) {
        throw new Error("Already revealed");
      }
      await ctx.db.patch(match._id, {
        player2Choice: args.choice,
        player2Nonce: args.nonce,
      });
    }

    // Check if both revealed
    const updated = await ctx.db.get(args.matchId);
    if (updated!.player1Choice !== undefined && updated!.player2Choice !== undefined) {
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

// Forfeit a match (if opponent times out or doesn't show)
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
      // Determine who forfeited
      let winner: typeof match.winner = "draw";

      if (match.status === "commit") {
        if (!match.player1Commit && match.player2Commit) {
          winner = match.player2;
        } else if (match.player1Commit && !match.player2Commit) {
          winner = match.player1;
        }
      } else if (match.status === "message") {
        if (!match.player1Message && match.player2Message) {
          winner = match.player2;
        } else if (match.player1Message && !match.player2Message) {
          winner = match.player1;
        }
      } else if (match.status === "guess") {
        if (match.player1Guess === undefined && match.player2Guess !== undefined) {
          winner = match.player2;
        } else if (match.player1Guess !== undefined && match.player2Guess === undefined) {
          winner = match.player1;
        }
      } else if (match.status === "reveal") {
        if (match.player1Choice === undefined && match.player2Choice !== undefined) {
          winner = match.player2;
        } else if (match.player1Choice !== undefined && match.player2Choice === undefined) {
          winner = match.player1;
        }
      }

      const now = Date.now();
      
      await ctx.db.patch(match._id, {
        status: "forfeit",
        winner,
        completedAt: now,
      });

      // Update lastPlayedAt for both players if match got far enough
      if (match.status !== "commit") {
        const player1 = await ctx.db.get(match.player1);
        const player2 = await ctx.db.get(match.player2);
        
        if (player1) {
          await ctx.db.patch(match.player1, { lastPlayedAt: now });
        }
        if (player2) {
          await ctx.db.patch(match.player2, { lastPlayedAt: now });
        }
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
