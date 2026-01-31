import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Clear all data (dev/test only)
export const clearAllData = mutation({
  args: {
    confirm: v.literal("yes-delete-everything"),
  },
  handler: async (ctx, args) => {
    const agents = await ctx.db.query("agents").collect();
    const matches = await ctx.db.query("matches").collect();
    const queue = await ctx.db.query("queue").collect();

    for (const agent of agents) {
      await ctx.db.delete(agent._id);
    }
    for (const match of matches) {
      await ctx.db.delete(match._id);
    }
    for (const q of queue) {
      await ctx.db.delete(q._id);
    }

    return {
      deleted: {
        agents: agents.length,
        matches: matches.length,
        queue: queue.length,
      },
    };
  },
});
