import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Hash a string using SHA-256
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Generate a random API key
function generateApiKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, "0")).join("");
}

// Force-verify an agent (admin/testing only)
export const forceVerify = mutation({
  args: {
    name: v.string(),
    confirm: v.literal("admin-override"),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (!agent) {
      throw new Error(`Agent "${args.name}" not found`);
    }

    if (agent.verified === true && agent.apiKeyHash !== "") {
      throw new Error(`Agent "${args.name}" is already verified`);
    }

    const apiKey = generateApiKey();
    const apiKeyHash = await sha256(apiKey);

    await ctx.db.patch(agent._id, {
      apiKeyHash,
      verified: true,
    });

    return { name: args.name, apiKey };
  },
});

// Clear queue and stale matches (for test resets)
export const clearQueueAndStaleMatches = mutation({
  args: {
    confirm: v.literal("admin-override"),
  },
  handler: async (ctx, args) => {
    // Clear queue
    const queue = await ctx.db.query("queue").collect();
    for (const q of queue) {
      await ctx.db.delete(q._id);
    }

    // Clear incomplete matches (not "complete")
    const matches = await ctx.db.query("matches").collect();
    let staleCount = 0;
    for (const m of matches) {
      if (m.status !== "complete") {
        await ctx.db.delete(m._id);
        staleCount++;
      }
    }

    return { queueCleared: queue.length, staleMatchesDeleted: staleCount };
  },
});

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
