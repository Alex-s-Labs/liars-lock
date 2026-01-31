import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get UTC day boundary (midnight UTC)
function getDayBoundary(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

// Calculate bonus Elo based on streak
function getBonusElo(streak: number): number {
  if (streak >= 7) return 25;
  if (streak >= 5) return 15;
  if (streak >= 3) return 10;
  if (streak >= 2) return 7;
  return 5; // Day 1
}

// Get daily status for an agent
export const getDailyStatus = query({
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

    const now = Date.now();
    const today = getDayBoundary(now);
    
    // Check if they've played today
    const lastPlayedDay = agent.lastPlayedAt ? getDayBoundary(agent.lastPlayedAt) : 0;
    const playedToday = lastPlayedDay === today;
    
    // Check if bonus is available
    const bonusAvailable = playedToday && (!agent.nextBonusAt || now >= agent.nextBonusAt);
    
    // Count games today (for display purposes)
    const gamesToday = playedToday ? 1 : 0; // Simplified - could count actual matches if needed
    
    return {
      streak: agent.streak || 0,
      bonusAvailable,
      nextBonusAt: agent.nextBonusAt || null,
      playedToday,
      gamesToday,
      totalBonusElo: agent.totalBonusElo || 0,
      badges: agent.badges || [],
    };
  },
});

// Claim daily reward
export const claimDaily = mutation({
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

    const now = Date.now();
    const today = getDayBoundary(now);
    
    // Check if they've played at least one game today
    if (!agent.lastPlayedAt) {
      throw new Error("You must play at least one game before claiming your daily bonus");
    }
    
    const lastPlayedDay = getDayBoundary(agent.lastPlayedAt);
    
    if (lastPlayedDay !== today) {
      throw new Error("You must play at least one game today before claiming your daily bonus");
    }
    
    // Check 24h cooldown
    if (agent.nextBonusAt && now < agent.nextBonusAt) {
      const hoursRemaining = Math.ceil((agent.nextBonusAt - now) / (1000 * 60 * 60));
      throw new Error(`Daily bonus cooldown active. Try again in ${hoursRemaining} hour(s)`);
    }
    
    // Calculate streak
    let newStreak = 1;
    if (agent.lastPlayedAt && agent.streak) {
      const yesterday = getDayBoundary(now - 24 * 60 * 60 * 1000);
      const lastPlayedDayBoundary = getDayBoundary(agent.lastPlayedAt);
      
      if (lastPlayedDayBoundary === yesterday) {
        // Played yesterday, increment streak
        newStreak = agent.streak + 1;
      } else if (lastPlayedDayBoundary === today) {
        // Already played today (claiming bonus for today)
        newStreak = agent.streak;
      }
      // If older than yesterday, streak resets to 1 (handled by default)
    }
    
    // Calculate bonus
    const bonusElo = getBonusElo(newStreak);
    
    // Update agent
    await ctx.db.patch(agent._id, {
      streak: newStreak,
      nextBonusAt: now + 24 * 60 * 60 * 1000, // 24 hours from now
      totalBonusElo: (agent.totalBonusElo || 0) + bonusElo,
      elo: agent.elo + bonusElo,
    });
    
    return {
      success: true,
      streak: newStreak,
      bonusElo,
      newElo: agent.elo + bonusElo,
      nextBonusAt: now + 24 * 60 * 60 * 1000,
      message: `Day ${newStreak} bonus claimed! +${bonusElo} Elo`,
    };
  },
});
