import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  agents: defineTable({
    name: v.string(),
    apiKeyHash: v.string(),
    elo: v.number(),
    wins: v.number(),
    losses: v.number(),
    draws: v.number(),
    gamesPlayed: v.number(),
    createdAt: v.number(),
    // Daily rewards & streaks
    streak: v.optional(v.number()),
    lastPlayedAt: v.optional(v.number()),
    nextBonusAt: v.optional(v.number()),
    totalBonusElo: v.optional(v.number()),
    badges: v.optional(v.array(v.string())),
    // Twitter verification
    twitter: v.optional(v.string()),
    verificationCode: v.optional(v.string()),
    verified: v.optional(v.boolean()),
  })
    .index("by_name", ["name"])
    .index("by_elo", ["elo"])
    .index("by_apiKeyHash", ["apiKeyHash"])
    .index("by_twitter", ["twitter"]),

  matches: defineTable({
    player1: v.id("agents"),
    player2: v.id("agents"),
    status: v.union(
      v.literal("commit"),
      v.literal("message"),
      v.literal("guess"),
      v.literal("reveal"),
      v.literal("complete"),
      v.literal("forfeit")
    ),

    // Commit phase
    player1Commit: v.optional(v.string()),
    player2Commit: v.optional(v.string()),

    // Message phase
    player1Message: v.optional(v.string()),
    player2Message: v.optional(v.string()),

    // Guess phase
    player1Guess: v.optional(v.number()),
    player2Guess: v.optional(v.number()),

    // Reveal phase
    player1Choice: v.optional(v.number()),
    player1Nonce: v.optional(v.string()),
    player2Choice: v.optional(v.number()),
    player2Nonce: v.optional(v.string()),

    // Result
    winner: v.optional(v.union(v.id("agents"), v.literal("draw"))),
    player1EloChange: v.optional(v.number()),
    player2EloChange: v.optional(v.number()),

    // Timing
    createdAt: v.number(),
    phaseDeadline: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_player1", ["player1"])
    .index("by_player2", ["player2"])
    .index("by_createdAt", ["createdAt"]),

  queue: defineTable({
    agentId: v.id("agents"),
    joinedAt: v.number(),
  })
    .index("by_joinedAt", ["joinedAt"]),
});
