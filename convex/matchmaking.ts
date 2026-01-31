import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const PHASE_TIMEOUT_MS = 60 * 1000; // 60 seconds

// Join the matchmaking queue
export const joinQueue = mutation({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    // Check if agent exists
    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }

    // Check if already in queue
    const existing = await ctx.db
      .query("queue")
      .filter((q) => q.eq(q.field("agentId"), args.agentId))
      .first();

    if (existing) {
      return { status: "already_queued" };
    }

    // Check if already in an active match
    const activeMatch = await ctx.db
      .query("matches")
      .filter((q) =>
        q.and(
          q.or(
            q.eq(q.field("player1"), args.agentId),
            q.eq(q.field("player2"), args.agentId)
          ),
          q.neq(q.field("status"), "complete"),
          q.neq(q.field("status"), "forfeit")
        )
      )
      .first();

    if (activeMatch) {
      return { status: "already_in_match", matchId: activeMatch._id };
    }

    // Add to queue
    await ctx.db.insert("queue", {
      agentId: args.agentId,
      joinedAt: Date.now(),
    });

    return { status: "queued" };
  },
});

// Find a match (either return existing match or create new one)
export const findMatch = mutation({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    // Check if agent exists
    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }

    // First, check if already in an active match
    const activeMatch = await ctx.db
      .query("matches")
      .filter((q) =>
        q.and(
          q.or(
            q.eq(q.field("player1"), args.agentId),
            q.eq(q.field("player2"), args.agentId)
          ),
          q.neq(q.field("status"), "complete"),
          q.neq(q.field("status"), "forfeit")
        )
      )
      .first();

    if (activeMatch) {
      const opponent = activeMatch.player1 === args.agentId 
        ? await ctx.db.get(activeMatch.player2)
        : await ctx.db.get(activeMatch.player1);

      return {
        status: "matched",
        matchId: activeMatch._id,
        opponentName: opponent?.name,
        phase: activeMatch.status,
      };
    }

    // Look for an opponent in the queue
    const opponent = await ctx.db
      .query("queue")
      .withIndex("by_joinedAt")
      .filter((q) => q.neq(q.field("agentId"), args.agentId))
      .first();

    if (opponent) {
      // Create match
      const matchId = await ctx.db.insert("matches", {
        player1: args.agentId,
        player2: opponent.agentId,
        status: "commit",
        createdAt: Date.now(),
        phaseDeadline: Date.now() + PHASE_TIMEOUT_MS,
      });

      // Remove both from queue
      await ctx.db.delete(opponent._id);
      
      // Remove self from queue if present
      const myQueueEntry = await ctx.db
        .query("queue")
        .filter((q) => q.eq(q.field("agentId"), args.agentId))
        .first();
      if (myQueueEntry) {
        await ctx.db.delete(myQueueEntry._id);
      }

      const opponentAgent = await ctx.db.get(opponent.agentId);

      return {
        status: "matched",
        matchId,
        opponentName: opponentAgent?.name,
        phase: "commit",
      };
    }

    // No opponent found, join queue
    const existingQueue = await ctx.db
      .query("queue")
      .filter((q) => q.eq(q.field("agentId"), args.agentId))
      .first();

    if (!existingQueue) {
      await ctx.db.insert("queue", {
        agentId: args.agentId,
        joinedAt: Date.now(),
      });
    }

    return {
      status: "queued",
      message: "Waiting for opponent...",
    };
  },
});

// Get queue status
export const getQueueStatus = query({
  args: {},
  handler: async (ctx) => {
    const queueEntries = await ctx.db.query("queue").collect();
    return {
      queueLength: queueEntries.length,
    };
  },
});
