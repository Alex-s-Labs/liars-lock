import { v } from "convex/values";
import { query } from "./_generated/server";

// Get leaderboard (top agents by Elo)
export const getLeaderboard = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;

    const agents = await ctx.db
      .query("agents")
      .withIndex("by_elo")
      .order("desc")
      .take(limit);

    return agents.map((agent) => ({
      _id: agent._id,
      name: agent.name,
      elo: agent.elo,
      wins: agent.wins,
      losses: agent.losses,
      draws: agent.draws,
      gamesPlayed: agent.gamesPlayed,
      createdAt: agent.createdAt,
    }));
  },
});

// Get recent matches
export const getRecentMatches = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    const matches = await ctx.db
      .query("matches")
      .withIndex("by_createdAt")
      .order("desc")
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "complete"),
          q.eq(q.field("status"), "forfeit")
        )
      )
      .take(limit);

    // Enrich with player data
    const enrichedMatches = await Promise.all(
      matches.map(async (match) => {
        const player1 = await ctx.db.get(match.player1);
        const player2 = await ctx.db.get(match.player2);

        return {
          _id: match._id,
          player1: player1 ? { _id: player1._id, name: player1.name } : null,
          player2: player2 ? { _id: player2._id, name: player2.name } : null,
          winner: match.winner,
          status: match.status,
          createdAt: match.createdAt,
          completedAt: match.completedAt,
          player1Choice: match.player1Choice,
          player2Choice: match.player2Choice,
          player1Message: match.player1Message,
          player2Message: match.player2Message,
          player1Guess: match.player1Guess,
          player2Guess: match.player2Guess,
          player1EloChange: match.player1EloChange,
          player2EloChange: match.player2EloChange,
        };
      })
    );

    return enrichedMatches;
  },
});

// Get matches for a specific agent
export const getAgentMatches = query({
  args: {
    agentId: v.id("agents"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    // Get matches where agent is player1
    const matchesAsPlayer1 = await ctx.db
      .query("matches")
      .withIndex("by_player1", (q) => q.eq("player1", args.agentId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "complete"),
          q.eq(q.field("status"), "forfeit")
        )
      )
      .collect();

    // Get matches where agent is player2
    const matchesAsPlayer2 = await ctx.db
      .query("matches")
      .withIndex("by_player2", (q) => q.eq("player2", args.agentId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "complete"),
          q.eq(q.field("status"), "forfeit")
        )
      )
      .collect();

    // Combine and sort by createdAt
    const allMatches = [...matchesAsPlayer1, ...matchesAsPlayer2]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);

    // Enrich with player data
    const enrichedMatches = await Promise.all(
      allMatches.map(async (match) => {
        const player1 = await ctx.db.get(match.player1);
        const player2 = await ctx.db.get(match.player2);

        return {
          _id: match._id,
          player1: player1 ? { _id: player1._id, name: player1.name } : null,
          player2: player2 ? { _id: player2._id, name: player2.name } : null,
          winner: match.winner,
          status: match.status,
          createdAt: match.createdAt,
          completedAt: match.completedAt,
          player1Choice: match.player1Choice,
          player2Choice: match.player2Choice,
          player1Message: match.player1Message,
          player2Message: match.player2Message,
          player1Guess: match.player1Guess,
          player2Guess: match.player2Guess,
          player1EloChange: match.player1EloChange,
          player2EloChange: match.player2EloChange,
        };
      })
    );

    return enrichedMatches;
  },
});
