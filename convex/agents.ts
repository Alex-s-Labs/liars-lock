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

// Generate a random verification code
function generateVerificationCode(): string {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  const hex = Array.from(array, byte => byte.toString(16).padStart(2, "0")).join("");
  return `liarslock-${hex}`;
}

// Validate Twitter handle (alphanumeric + underscore, 1-15 chars)
function validateTwitterHandle(handle: string): string {
  // Strip @ prefix if present
  const clean = handle.startsWith("@") ? handle.slice(1) : handle;
  if (!clean || clean.length < 1 || clean.length > 15) {
    throw new Error("Twitter handle must be 1-15 characters");
  }
  if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
    throw new Error("Twitter handle can only contain letters, numbers, and underscores");
  }
  return clean.toLowerCase();
}

// Step 1: Initiate registration (no API key yet)
export const register = mutation({
  args: {
    name: v.string(),
    twitter: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate name
    if (!args.name || args.name.length < 2 || args.name.length > 32) {
      throw new Error("Name must be 2-32 characters");
    }

    // Validate and normalize twitter handle
    const twitter = validateTwitterHandle(args.twitter);

    // Check if name already exists
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      // If the agent exists but isn't verified, allow re-registration (update the code)
      if (existing.verified !== true) {
        const verificationCode = generateVerificationCode();
        await ctx.db.patch(existing._id, {
          twitter,
          verificationCode,
          verified: false,
        });
        return {
          verificationCode,
          message: `Add this code to your Twitter/X bio (@${twitter}), then call POST /api/register/verify`,
        };
      }
      throw new Error("Agent name already taken");
    }

    // Check if twitter handle is already taken by another agent
    const existingTwitter = await ctx.db
      .query("agents")
      .withIndex("by_twitter", (q) => q.eq("twitter", twitter))
      .first();

    if (existingTwitter && existingTwitter.verified === true) {
      throw new Error("This Twitter handle is already registered to another agent");
    }
    // If the handle is taken by an unverified agent, that's fine — they didn't finish

    const verificationCode = generateVerificationCode();

    // Check if early adopter (first 100 agents)
    const allAgents = await ctx.db.query("agents").collect();
    const isEarlyAdopter = allAgents.length < 100;

    const startingElo = isEarlyAdopter ? 1225 : 1200;
    const badges = isEarlyAdopter ? ["early_adopter"] : [];

    // Create agent WITHOUT an API key (will be generated on verification)
    await ctx.db.insert("agents", {
      name: args.name,
      apiKeyHash: "", // No key until verified
      elo: startingElo,
      wins: 0,
      losses: 0,
      draws: 0,
      gamesPlayed: 0,
      createdAt: Date.now(),
      badges: badges.length > 0 ? badges : undefined,
      twitter,
      verificationCode,
      verified: false,
    });

    return {
      verificationCode,
      message: `Add this code to your Twitter/X bio (@${twitter}), then call POST /api/register/verify`,
    };
  },
});

// Step 2: Verify registration (check Twitter bio, issue API key)
export const verifyRegistration = mutation({
  args: {
    name: v.string(),
    twitter: v.string(),
    bioContent: v.string(), // The fetched bio content, passed from the API route
  },
  handler: async (ctx, args) => {
    const twitter = validateTwitterHandle(args.twitter);

    // Look up the agent by name
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (!agent) {
      throw new Error("Agent not found. Register first with POST /api/register");
    }

    if (agent.verified === true) {
      throw new Error("Agent is already verified");
    }

    if (agent.twitter !== twitter) {
      throw new Error("Twitter handle does not match the one used during registration");
    }

    if (!agent.verificationCode) {
      throw new Error("No verification code found. Register again.");
    }

    // Check if the bio contains the verification code
    if (!args.bioContent.includes(agent.verificationCode)) {
      throw new Error("Verification code not found in bio. Make sure it's in your Twitter/X bio.");
    }

    // Generate API key now that they're verified
    const apiKey = generateApiKey();
    const apiKeyHash = await sha256(apiKey);

    // Check if early adopter
    const allAgents = await ctx.db.query("agents").collect();
    const isEarlyAdopter = allAgents.length <= 100;

    const startingElo = isEarlyAdopter ? 1225 : 1200;
    const badges = isEarlyAdopter ? ["early_adopter"] : [];

    await ctx.db.patch(agent._id, {
      apiKeyHash,
      verified: true,
      elo: startingElo,
      badges: badges.length > 0 ? badges : undefined,
    });

    return {
      agentId: agent._id,
      name: agent.name,
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
      badges: agent.badges || [],
      twitter: agent.twitter || null,
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
