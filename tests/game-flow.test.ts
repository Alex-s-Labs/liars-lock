import { describe, it, expect, beforeAll } from "vitest";

// Integration tests against the running dev server + real Convex
// Run with: npm test (requires dev server on TEST_BASE_URL or localhost:3001)

const BASE = process.env.TEST_BASE_URL || "http://localhost:3001";

async function register(name: string) {
  const res = await fetch(`${BASE}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data as { agentId: string; apiKey: string; name: string; elo: number };
}

function authHeaders(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

async function findMatch(apiKey: string) {
  const res = await fetch(`${BASE}/api/match/find`, {
    method: "POST",
    headers: authHeaders(apiKey),
  });
  return res.json();
}

async function getMatch(matchId: string, apiKey?: string) {
  const headers: Record<string, string> = {};
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const res = await fetch(`${BASE}/api/match/${matchId}`, { headers });
  return res.json();
}

async function play(matchId: string, apiKey: string, choice: number, claim: number, message?: string) {
  const res = await fetch(`${BASE}/api/match/${matchId}/play`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({ choice, claim, message }),
  });
  return res.json();
}

async function guess(matchId: string, apiKey: string, guessVal: number) {
  const res = await fetch(`${BASE}/api/match/${matchId}/guess`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({ guess: guessVal }),
  });
  return res.json();
}

// Generate unique names per test run to avoid collisions
const RUN_ID = Date.now().toString(36);

describe("Registration", () => {
  it("registers a new agent", async () => {
    const agent = await register(`RegTest_${RUN_ID}`);
    expect(agent.apiKey).toBeTruthy();
    expect(agent.elo).toBe(1200);
    expect(agent.name).toBe(`RegTest_${RUN_ID}`);
  });

  it("rejects duplicate names", async () => {
    const name = `Dupe_${RUN_ID}`;
    await register(name);
    await expect(register(name)).rejects.toThrow();
  });

  it("rejects empty names", async () => {
    const res = await fetch(`${BASE}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    expect(res.ok).toBe(false);
  });

  it("rejects names that are too short", async () => {
    const res = await fetch(`${BASE}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "X" }),
    });
    expect(res.ok).toBe(false);
  });
});

describe("Authentication", () => {
  it("GET /api/agent/me works with valid key", async () => {
    const agent = await register(`Auth_${RUN_ID}`);
    const res = await fetch(`${BASE}/api/agent/me`, {
      headers: { Authorization: `Bearer ${agent.apiKey}` },
    });
    const data = await res.json();
    expect(data.name).toBe(`Auth_${RUN_ID}`);
  });

  it("GET /api/agent/me rejects invalid key", async () => {
    const res = await fetch(`${BASE}/api/agent/me`, {
      headers: { Authorization: "Bearer invalidkey123" },
    });
    expect(res.ok).toBe(false);
  });

  it("GET /api/agent/me rejects missing auth", async () => {
    const res = await fetch(`${BASE}/api/agent/me`);
    expect(res.ok).toBe(false);
  });
});

describe("Matchmaking", () => {
  it("first agent queues, second agent matches", async () => {
    const a1 = await register(`MM1_${RUN_ID}`);
    const a2 = await register(`MM2_${RUN_ID}`);

    const r1 = await findMatch(a1.apiKey);
    expect(r1.status).toBe("queued");

    const r2 = await findMatch(a2.apiKey);
    expect(r2.status).toBe("matched");
    expect(r2.matchId).toBeTruthy();
    expect(r2.phase).toBe("play");
  });

  it("returns existing match if already in one", async () => {
    const a1 = await register(`MMDup1_${RUN_ID}`);
    const a2 = await register(`MMDup2_${RUN_ID}`);

    await findMatch(a1.apiKey);
    const r2 = await findMatch(a2.apiKey);

    // Calling find again should return the same match
    const r2Again = await findMatch(a2.apiKey);
    expect(r2Again.status).toBe("matched");
    expect(r2Again.matchId).toBe(r2.matchId);
  });
});

describe("Full Game Flow", () => {
  let a1: Awaited<ReturnType<typeof register>>;
  let a2: Awaited<ReturnType<typeof register>>;
  let matchId: string;

  beforeAll(async () => {
    a1 = await register(`Game1_${RUN_ID}`);
    a2 = await register(`Game2_${RUN_ID}`);

    await findMatch(a1.apiKey);
    const r2 = await findMatch(a2.apiKey);
    matchId = r2.matchId;
  });

  it("starts in play phase", async () => {
    const match = await getMatch(matchId, a1.apiKey);
    expect(match.status).toBe("play");
    expect(match.player1Played).toBe(false);
    expect(match.player2Played).toBe(false);
  });

  it("accepts plays and advances to guess phase", async () => {
    // a1 picks 1, claims 0 (lying), with a message
    const p1 = await play(matchId, a1.apiKey, 1, 0, "I picked 0 for sure!");
    expect(p1.success).toBe(true);

    // Match should still be in play until both play
    const midMatch = await getMatch(matchId, a1.apiKey);
    expect(midMatch.status).toBe("play");
    expect(midMatch.player1Played).toBe(true);
    expect(midMatch.player2Played).toBe(false);

    // a2 picks 0, claims 0 (truth), with a message
    const p2 = await play(matchId, a2.apiKey, 0, 0, "Also picked 0");
    expect(p2.success).toBe(true);

    const match = await getMatch(matchId);
    expect(match.status).toBe("guess");
    // Claims and messages should be visible now
    expect(match.player1Claim).toBe(0);
    expect(match.player2Claim).toBe(0);
    expect(match.player1Message).toBe("I picked 0 for sure!");
    expect(match.player2Message).toBe("Also picked 0");
  });

  it("rejects double play", async () => {
    const res = await fetch(`${BASE}/api/match/${matchId}/play`, {
      method: "POST",
      headers: authHeaders(a1.apiKey),
      body: JSON.stringify({ choice: 0, claim: 0 }),
    });
    const data = await res.json();
    expect(data.error).toMatch(/not in play phase/i);
  });

  it("accepts guesses and resolves match", async () => {
    // a1 guesses opponent's actual choice is 0 (correct! a2 chose 0)
    const g1 = await guess(matchId, a1.apiKey, 0);
    expect(g1.success).toBe(true);

    // a2 guesses opponent's actual choice is 0 (wrong! a1 chose 1)
    const g2 = await guess(matchId, a2.apiKey, 0);
    expect(g2.success).toBe(true);

    const match = await getMatch(matchId);
    expect(match.status).toBe("complete");
    // a1 guessed correctly, a2 guessed wrong → a1 wins
    expect(match.winner).toBeTruthy();
    expect(match.player1Choice).toBe(1);
    expect(match.player2Choice).toBe(0);
    expect(match.player1Claim).toBe(0);
    expect(match.player2Claim).toBe(0);
    expect(match.player1EloChange).toBeDefined();
    expect(match.player2EloChange).toBeDefined();
  });

  it("shows on leaderboard after completion", async () => {
    const res = await fetch(`${BASE}/api/leaderboard`);
    const data = await res.json();
    const names = data.map((a: any) => a.name);
    expect(names).toContain(`Game1_${RUN_ID}`);
    expect(names).toContain(`Game2_${RUN_ID}`);
  });

  it("shows in recent matches", async () => {
    const res = await fetch(`${BASE}/api/matches/recent`);
    const data = await res.json();
    const ids = data.map((m: any) => m._id);
    expect(ids).toContain(matchId);
  });
});

describe("Draw scenario", () => {
  it("both correct → draw", async () => {
    const a1 = await register(`Draw1_${RUN_ID}`);
    const a2 = await register(`Draw2_${RUN_ID}`);

    await findMatch(a1.apiKey);
    const r = await findMatch(a2.apiKey);
    const mid = r.matchId;

    // Both choose 1, both claim 1 (truth)
    await play(mid, a1.apiKey, 1, 1, "hi");
    await play(mid, a2.apiKey, 1, 1, "hi");
    // Both guess 1 (both correct)
    await guess(mid, a1.apiKey, 1);
    await guess(mid, a2.apiKey, 1);

    const match = await getMatch(mid);
    expect(match.status).toBe("complete");
    expect(match.winner).toBe("draw");
    expect(match.player1EloChange).toBe(0);
    expect(match.player2EloChange).toBe(0);
  });

  it("both wrong → draw", async () => {
    const a1 = await register(`Draw3_${RUN_ID}`);
    const a2 = await register(`Draw4_${RUN_ID}`);

    await findMatch(a1.apiKey);
    const r = await findMatch(a2.apiKey);
    const mid = r.matchId;

    // a1 chooses 1 (claims 0), a2 chooses 0 (claims 1)
    await play(mid, a1.apiKey, 1, 0, "bluff");
    await play(mid, a2.apiKey, 0, 1, "bluff");
    // a1 guesses opponent chose 1 (wrong, they chose 0)
    // a2 guesses opponent chose 0 (wrong, they chose 1)
    await guess(mid, a1.apiKey, 1);
    await guess(mid, a2.apiKey, 0);

    const match = await getMatch(mid);
    expect(match.status).toBe("complete");
    expect(match.winner).toBe("draw");
  });
});

describe("Public endpoints", () => {
  it("GET /api/agent/:name returns public profile", async () => {
    const a = await register(`Pub_${RUN_ID}`);
    const res = await fetch(`${BASE}/api/agent/${a.name}`);
    const data = await res.json();
    expect(data.name).toBe(a.name);
    expect(data.elo).toBe(1200);
    // Should not expose API key
    expect(data.apiKeyHash).toBeUndefined();
    expect(data.apiKey).toBeUndefined();
  });

  it("GET /api/agent/:name returns 404 for unknown", async () => {
    const res = await fetch(`${BASE}/api/agent/nonexistent_${RUN_ID}`);
    expect(res.status).toBe(404);
  });

  it("GET /api/leaderboard returns sorted by elo", async () => {
    const res = await fetch(`${BASE}/api/leaderboard`);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    // Verify sorted descending
    for (let i = 1; i < data.length; i++) {
      expect(data[i - 1].elo).toBeGreaterThanOrEqual(data[i].elo);
    }
  });
});
