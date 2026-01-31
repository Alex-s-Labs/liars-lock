import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash } from "crypto";

// Integration tests against the running dev server + real Convex
// Run with: npm test (requires dev server on TEST_BASE_URL or localhost:3001)

const BASE = process.env.TEST_BASE_URL || "http://localhost:3001";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

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

async function commit(matchId: string, apiKey: string, hash: string) {
  const res = await fetch(`${BASE}/api/match/${matchId}/commit`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({ hash }),
  });
  return res.json();
}

async function sendMessage(matchId: string, apiKey: string, message: string) {
  const res = await fetch(`${BASE}/api/match/${matchId}/message`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({ message }),
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

async function reveal(matchId: string, apiKey: string, choice: number, nonce: string) {
  const res = await fetch(`${BASE}/api/match/${matchId}/reveal`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({ choice, nonce }),
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
    expect(r2.phase).toBe("commit");
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

  it("starts in commit phase", async () => {
    const match = await getMatch(matchId, a1.apiKey);
    expect(match.status).toBe("commit");
    expect(match.myCommitStatus).toBe(false);
  });

  it("accepts commits and advances to message phase", async () => {
    const hash1 = sha256("1:nonce1");
    const hash2 = sha256("0:nonce2");

    const c1 = await commit(matchId, a1.apiKey, hash1);
    expect(c1.success).toBe(true);

    // Match should still be in commit until both commit
    const midMatch = await getMatch(matchId, a1.apiKey);
    expect(midMatch.status).toBe("commit");
    expect(midMatch.myCommitStatus).toBe(true);
    expect(midMatch.opponentCommitStatus).toBe(false);

    const c2 = await commit(matchId, a2.apiKey, hash2);
    expect(c2.success).toBe(true);

    const match = await getMatch(matchId);
    expect(match.status).toBe("message");
  });

  it("rejects double commit", async () => {
    const res = await fetch(`${BASE}/api/match/${matchId}/commit`, {
      method: "POST",
      headers: authHeaders(a1.apiKey),
      body: JSON.stringify({ hash: "duplicate" }),
    });
    const data = await res.json();
    expect(data.error).toMatch(/not in commit phase/i);
  });

  it("accepts messages and advances to guess phase", async () => {
    const m1 = await sendMessage(matchId, a1.apiKey, "I chose 1!");
    expect(m1.success).toBe(true);

    const m2 = await sendMessage(matchId, a2.apiKey, "Or did you?");
    expect(m2.success).toBe(true);

    const match = await getMatch(matchId);
    expect(match.status).toBe("guess");
    expect(match.player1Message).toBeTruthy();
    expect(match.player2Message).toBeTruthy();
  });

  it("accepts guesses and advances to reveal phase", async () => {
    // a1 guesses opponent chose 0 (correct!)
    const g1 = await guess(matchId, a1.apiKey, 0);
    expect(g1.success).toBe(true);

    // a2 guesses opponent chose 0 (wrong — a1 chose 1)
    const g2 = await guess(matchId, a2.apiKey, 0);
    expect(g2.success).toBe(true);

    const match = await getMatch(matchId);
    expect(match.status).toBe("reveal");
  });

  it("validates reveals and resolves match", async () => {
    const r1 = await reveal(matchId, a1.apiKey, 1, "nonce1");
    expect(r1.success).toBe(true);

    const r2 = await reveal(matchId, a2.apiKey, 0, "nonce2");
    expect(r2.success).toBe(true);

    const match = await getMatch(matchId);
    expect(match.status).toBe("complete");
    // a1 guessed correctly (opponent=0), a2 guessed wrong (guessed 0, was 1)
    expect(match.winner).toBeTruthy();
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

    // Both choose 1
    await commit(mid, a1.apiKey, sha256("1:d1"));
    await commit(mid, a2.apiKey, sha256("1:d2"));
    await sendMessage(mid, a1.apiKey, "hi");
    await sendMessage(mid, a2.apiKey, "hi");
    // Both guess 1 (both correct)
    await guess(mid, a1.apiKey, 1);
    await guess(mid, a2.apiKey, 1);
    await reveal(mid, a1.apiKey, 1, "d1");
    await reveal(mid, a2.apiKey, 1, "d2");

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

    // a1 chooses 1, a2 chooses 0
    await commit(mid, a1.apiKey, sha256("1:w1"));
    await commit(mid, a2.apiKey, sha256("0:w2"));
    await sendMessage(mid, a1.apiKey, "bluff");
    await sendMessage(mid, a2.apiKey, "bluff");
    // Both guess wrong: a1 guesses 1 (opponent chose 0), a2 guesses 1 (opponent chose 1, actually correct... let me fix)
    // a1 chose 1, a2 chose 0
    // a1 guesses opponent chose 1 (wrong, they chose 0)
    // a2 guesses opponent chose 0 (wrong, they chose 1)
    await guess(mid, a1.apiKey, 1);
    await guess(mid, a2.apiKey, 0);
    await reveal(mid, a1.apiKey, 1, "w1");
    await reveal(mid, a2.apiKey, 0, "w2");

    const match = await getMatch(mid);
    expect(match.status).toBe("complete");
    expect(match.winner).toBe("draw");
  });
});

describe("Cheating detection", () => {
  it("rejects mismatched reveal hash", async () => {
    const a1 = await register(`Cheat1_${RUN_ID}`);
    const a2 = await register(`Cheat2_${RUN_ID}`);

    await findMatch(a1.apiKey);
    const r = await findMatch(a2.apiKey);
    const mid = r.matchId;

    // a1 commits to choice 1 but will try to reveal 0
    await commit(mid, a1.apiKey, sha256("1:cheatnonce"));
    await commit(mid, a2.apiKey, sha256("0:honest"));
    await sendMessage(mid, a1.apiKey, "trust me");
    await sendMessage(mid, a2.apiKey, "ok");
    await guess(mid, a1.apiKey, 0);
    await guess(mid, a2.apiKey, 0);

    // a1 tries to reveal choice=0 (committed to 1) — hash won't match
    const res = await fetch(`${BASE}/api/match/${mid}/reveal`, {
      method: "POST",
      headers: authHeaders(a1.apiKey),
      body: JSON.stringify({ choice: 0, nonce: "cheatnonce" }),
    });
    const data = await res.json();
    expect(data.error).toMatch(/cheated/i);

    // Match should be complete with a2 winning
    const match = await getMatch(mid);
    expect(match.status).toBe("complete");
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
