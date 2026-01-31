import { v } from "convex/values";
import { mutation, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const K_FACTOR = 32;

// Calculate Elo change
export function calculateElo(
  myElo: number,
  opponentElo: number,
  result: number // 1 = win, 0.5 = draw, 0 = loss
): number {
  const expected = 1 / (1 + Math.pow(10, (opponentElo - myElo) / 400));
  const change = Math.round(K_FACTOR * (result - expected));
  return change;
}

// Core Elo update logic — callable from other mutations
export async function updateEloForMatch(
  ctx: MutationCtx,
  matchId: Id<"matches">
) {
  const match = await ctx.db.get(matchId);
  if (!match) {
    throw new Error("Match not found");
  }

  if (match.status !== "complete") {
    throw new Error("Match not complete");
  }

  // Don't update if already updated
  if (match.player1EloChange !== undefined) {
    return;
  }

  const player1 = await ctx.db.get(match.player1);
  const player2 = await ctx.db.get(match.player2);

  if (!player1 || !player2) {
    throw new Error("Players not found");
  }

  // Determine result
  let player1Result: number;
  let player2Result: number;

  if (match.winner === "draw") {
    player1Result = 0.5;
    player2Result = 0.5;
  } else if (match.winner === match.player1) {
    player1Result = 1;
    player2Result = 0;
  } else if (match.winner === match.player2) {
    player1Result = 0;
    player2Result = 1;
  } else {
    throw new Error("Invalid match winner");
  }

  // Calculate Elo changes
  const player1EloChange = calculateElo(player1.elo, player2.elo, player1Result);
  const player2EloChange = calculateElo(player2.elo, player1.elo, player2Result);

  // Update match with Elo changes
  await ctx.db.patch(match._id, {
    player1EloChange,
    player2EloChange,
  });

  // Update player stats
  await ctx.db.patch(match.player1, {
    elo: player1.elo + player1EloChange,
    gamesPlayed: player1.gamesPlayed + 1,
    wins: player1.wins + (player1Result === 1 ? 1 : 0),
    losses: player1.losses + (player1Result === 0 ? 1 : 0),
    draws: player1.draws + (player1Result === 0.5 ? 1 : 0),
  });

  await ctx.db.patch(match.player2, {
    elo: player2.elo + player2EloChange,
    gamesPlayed: player2.gamesPlayed + 1,
    wins: player2.wins + (player2Result === 1 ? 1 : 0),
    losses: player2.losses + (player2Result === 0 ? 1 : 0),
    draws: player2.draws + (player2Result === 0.5 ? 1 : 0),
  });

  return {
    player1EloChange,
    player2EloChange,
    player1NewElo: player1.elo + player1EloChange,
    player2NewElo: player2.elo + player2EloChange,
  };
}

// Public mutation wrapper (for calling from API routes if needed)
export const updateElo = mutation({
  args: {
    matchId: v.id("matches"),
  },
  handler: async (ctx, args) => {
    return updateEloForMatch(ctx, args.matchId);
  },
});
