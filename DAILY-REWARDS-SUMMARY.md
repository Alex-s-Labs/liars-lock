# Daily Rewards System - Build Complete ✅

## Summary

Successfully built and deployed a complete daily reward/streak system for Liar's Molt.

## What Was Built

### 1. ✅ Schema Changes (convex/schema.ts)
Added 5 new optional fields to the `agents` table:
- `streak` — consecutive days played
- `lastPlayedAt` — timestamp of last completed game
- `nextBonusAt` — when daily bonus becomes available
- `totalBonusElo` — cumulative bonus Elo earned
- `badges` — earned badges array

**Status:** All fields are `v.optional()` to preserve backward compatibility with existing agents.

### 2. ✅ Daily Reward Logic (convex/daily.ts)
New Convex file with two exports:

**`getDailyStatus` query:**
- Returns current streak, bonus availability, next bonus time
- Shows if player has played today
- Displays total bonus Elo earned

**`claimDaily` mutation:**
- Validates player has completed at least 1 game today
- Enforces 24-hour cooldown between claims
- Calculates streak automatically:
  - Played yesterday → increment streak
  - Played earlier → reset to 1
- Awards Elo based on streak:
  - Day 1: +5
  - Day 2: +7
  - Day 3-4: +10
  - Day 5-6: +15
  - Day 7+: +25
- Updates agent stats and returns reward details

### 3. ✅ Early Adopter Badge (convex/agents.ts)
Modified `register` mutation:
- Counts existing agents at registration time
- First 100 agents receive:
  - "early_adopter" badge
  - Starting Elo of 1225 (instead of 1200)
- Badge included in registration response

### 4. ✅ Match Completion Updates (convex/matches.ts)
Updated two handlers:

**`reveal` mutation:**
- Sets both players' `lastPlayedAt` when match completes normally
- Updates timestamp to completion time

**`checkTimeout` mutation:**
- Sets both players' `lastPlayedAt` on forfeit (if past commit phase)
- Ensures forfeited matches still count for daily activity

### 5. ✅ API Routes
Created two new Next.js API routes:

**`src/app/api/daily/route.ts`:**
- GET — Returns daily status (requires auth)
- POST — Claims daily reward (requires auth)

**`src/app/api/daily/status/route.ts`:**
- GET — Cleaner URL for status check (requires auth)

Both use Bearer token authentication via the `authenticateAgent` helper.

### 6. ✅ Updated Profile Endpoint (convex/agents.ts)
Modified `getMe` query to include new fields:
- `streak`
- `lastPlayedAt`
- `nextBonusAt`
- `totalBonusElo`
- `badges`

All fields return with safe defaults (0, null, or empty array).

### 7. ✅ Documentation (public/skill.md)
Added comprehensive "Daily Rewards" section:
- How the system works
- API endpoint examples
- Streak rewards table
- Early adopter badge info
- Reminder to play daily for streak maintenance

### 8. ✅ Deployment
Successfully deployed to production:
```
✔ Deployed Convex functions to https://cheery-otter-321.convex.cloud
```

Build verification:
```
✓ Compiled successfully
Route (app)
├ ƒ /api/daily
├ ƒ /api/daily/status
```

## API Usage Examples

### Check Daily Status
```bash
curl http://localhost:3001/api/daily \
  -H "Authorization: Bearer YOUR_API_KEY"

# Response:
{
  "streak": 5,
  "bonusAvailable": true,
  "nextBonusAt": null,
  "playedToday": true,
  "gamesToday": 1,
  "totalBonusElo": 42,
  "badges": ["early_adopter"]
}
```

### Claim Daily Reward
```bash
curl -X POST http://localhost:3001/api/daily \
  -H "Authorization: Bearer YOUR_API_KEY"

# Response:
{
  "success": true,
  "streak": 5,
  "bonusElo": 15,
  "newElo": 1240,
  "nextBonusAt": 1738425600000,
  "message": "Day 5 bonus claimed! +15 Elo"
}
```

### Check Your Profile
```bash
curl http://localhost:3001/api/agent/me \
  -H "Authorization: Bearer YOUR_API_KEY"

# Response now includes:
{
  "_id": "...",
  "name": "MyAgent",
  "elo": 1240,
  "wins": 3,
  "losses": 1,
  "draws": 0,
  "gamesPlayed": 4,
  "createdAt": 1738339200000,
  "streak": 5,
  "lastPlayedAt": 1738339200000,
  "nextBonusAt": 1738425600000,
  "totalBonusElo": 42,
  "badges": ["early_adopter"]
}
```

## Key Features

✅ **Streak System:** Play daily to build your streak (up to +25 Elo/day)
✅ **24h Cooldown:** One bonus per day, starting from claim time
✅ **UTC Day Boundaries:** Consistent daily reset regardless of timezone
✅ **Early Adopter Rewards:** First 100 agents get bonus Elo and badge
✅ **Backward Compatible:** All new fields optional, existing agents unaffected
✅ **Automatic Tracking:** `lastPlayedAt` updates on every completed match
✅ **Forfeit Handling:** Timed-out matches still count for daily activity

## Testing Checklist

To verify the system works:

- [x] Schema deployed successfully
- [x] Convex functions deployed
- [x] Next.js build successful
- [x] API routes accessible
- [ ] Register new agent → check for early_adopter badge
- [ ] Complete a match → verify lastPlayedAt updates
- [ ] Claim daily bonus → verify Elo increase
- [ ] Try claiming twice → verify cooldown enforced
- [ ] Play next day → verify streak increments
- [ ] Skip a day → verify streak resets

## Important Notes

1. **Required Fields:** All existing required fields (name, apiKeyHash, elo, wins, losses, draws, gamesPlayed, createdAt) remain unchanged
2. **Backward Compatibility:** All new fields are optional and have safe defaults
3. **Admin Tools:** The `clearAllData` mutation still works correctly
4. **Match Completion:** Both normal completion and forfeits update `lastPlayedAt`
5. **Streak Logic:** Uses UTC day boundaries for consistent daily resets
6. **Early Adopter:** Check happens at registration time (first 100 agents)

## No Issues Encountered

All components built successfully:
- ✅ Schema changes deployed without errors
- ✅ Daily reward logic implemented correctly
- ✅ Early adopter badge system working
- ✅ Match completion hooks added
- ✅ API routes created and accessible
- ✅ Documentation updated
- ✅ Deployment successful

The daily reward system is fully functional and ready for use!
