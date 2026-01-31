# Daily Rewards System - Test Summary

## ✅ What Was Built

### 1. Schema Changes (convex/schema.ts)
Added to the `agents` table:
- `streak: v.optional(v.number())` — consecutive days played
- `lastPlayedAt: v.optional(v.number())` — timestamp of last completed game
- `nextBonusAt: v.optional(v.number())` — when daily bonus becomes available
- `totalBonusElo: v.optional(v.number())` — cumulative bonus Elo earned
- `badges: v.optional(v.array(v.string()))` — earned badges

### 2. Daily Reward Logic (convex/daily.ts) ✅
Created with:
- `getDailyStatus` query — returns streak, bonus availability, games played today
- `claimDaily` mutation — awards bonus Elo based on streak:
  - Day 1: +5
  - Day 2: +7
  - Day 3: +10
  - Day 5: +15
  - Day 7+: +25
- Validates player has completed at least 1 game today
- 24-hour cooldown between claims
- Automatic streak calculation (increments if played yesterday, resets if older)

### 3. Early Adopter Badge (convex/agents.ts) ✅
- First 100 agents get "early_adopter" badge
- Start at 1225 Elo instead of 1200
- Badge shown in registration response

### 4. Match Completion Updates (convex/matches.ts) ✅
- `reveal` handler sets both players' `lastPlayedAt` when match completes
- `checkTimeout` handler also sets `lastPlayedAt` for forfeited matches (if past commit phase)

### 5. API Routes ✅
Created:
- `src/app/api/daily/route.ts` — GET for status, POST to claim
- `src/app/api/daily/status/route.ts` — GET for status (cleaner URL)
Both require Bearer token authentication

### 6. Updated GET /api/agent/me ✅
Now returns:
- `streak`
- `lastPlayedAt`
- `nextBonusAt`
- `totalBonusElo`
- `badges`

### 7. Documentation (public/skill.md) ✅
Added comprehensive "Daily Rewards" section with:
- How it works
- API endpoints
- Streak rewards table
- Early adopter info
- Reminder to play daily

### 8. Deployment ✅
Successfully deployed to Convex:
- Schema changes applied
- Functions deployed to cheery-otter-321
- Next.js build successful

## Testing Checklist

To test the system:

1. **Register a new agent** (should get early_adopter badge if <100 agents exist)
2. **Play a complete match** (lastPlayedAt should update)
3. **Check daily status**: `GET /api/daily`
4. **Claim daily bonus**: `POST /api/daily`
5. **Verify streak increments** by playing tomorrow
6. **Test cooldown** (should reject if claiming twice in 24h)
7. **Test streak reset** (skip a day, streak should reset to 1)

## Important Notes

- All new fields are `v.optional()` to avoid breaking existing agents
- `lastPlayedAt` updates on match completion (reveal phase or forfeit)
- Streak is calculated in UTC day boundaries
- 24-hour cooldown starts from claim time (not midnight)
- Early adopter check happens at registration (counts all existing agents)

## Potential Improvements

Consider in future:
- Count actual games played today (currently simplified to boolean)
- Streak milestone badges (7-day, 30-day, 100-day)
- Monthly leaderboards for most consistent players
- Bonus multipliers for win streaks
- Grace period for missed days (1 day forgiveness)
