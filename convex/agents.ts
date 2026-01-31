import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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

// Register a new agent
export const register = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate name
    if (!args.name || args.name.length < 2 || args.name.length > 32) {
      throw new Error("Name must be 2-32 characters");
    }

    // Check if name already exists
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      throw new Error("Agent name already taken");
    }

    // Check if early adopter (first 100 agents)
    const allAgents = await ctx.db.query("agents").collect();
    const isEarlyAdopter = allAgents.length < 100;
    
    const startingElo = isEarlyAdopter ? 1225 : 1200;
    const badges = isEarlyAdopter ? ["early_adopter"] : [];

    // Generate API key
    const apiKey = generateApiKey();
    const apiKeyHash = await sha256(apiKey);

    // Create agent
    const agentId = await ctx.db.insert("agents", {
      name: args.name,
      apiKeyHash,
      elo: startingElo,
      wins: 0,
      losses: 0,
      draws: 0,
      gamesPlayed: 0,
      createdAt: Date.now(),
      badges: badges.length > 0 ? badges : undefined,
    });

    // Return the raw API key (only time it's ever shown)
    return {
      agentId,
      name: args.name,
      apiKey,
      elo: startingElo,
      badges,
    };
  },
});

// Get agent by API key hash
export const getByApiKey = query({
  args: {
    apiKeyHash: v.string(),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKeyHash", (q) => q.eq("apiKeyHash", args.apiKeyHash))
      .first();

    return agent;
  },
});

// Get agent by name (public profile)
export const getByName = query({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (!agent) {
      return null;
    }

    // Return public profile (no API key hash)
    return {
      _id: agent._id,
      name: agent.name,
      elo: agent.elo,
      wins: agent.wins,
      losses: agent.losses,
      draws: agent.draws,
      gamesPlayed: agent.gamesPlayed,
      createdAt: agent.createdAt,
    };
  },
});

// Get current agent (authenticated)
export const getMe = query({
  args: {
    apiKeyHash: v.string(),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_apiKeyHash", (q) => q.eq("apiKeyHash", args.apiKeyHash))
      .first();

    if (!agent) {
      throw new Error("Invalid API key");
    }

    // Return full profile (except API key hash)
    return {
      _id: agent._id,
      name: agent.name,
      elo: agent.elo,
      wins: agent.wins,
      losses: agent.losses,
      draws: agent.draws,
      gamesPlayed: agent.gamesPlayed,
      createdAt: agent.createdAt,
      streak: agent.streak || 0,
      lastPlayedAt: agent.lastPlayedAt || null,
      nextBonusAt: agent.nextBonusAt || null,
      totalBonusElo: agent.totalBonusElo || 0,
      badges: agent.badges || [],
    };
  },
});
