// Quick API test script
const BASE_URL = "http://localhost:3000";

async function test() {
  console.log("🧪 Testing Liar's Lock API...\n");

  try {
    // 1. Register agent
    console.log("1️⃣  Registering agent...");
    const registerRes = await fetch(`${BASE_URL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `TestBot${Date.now()}` }),
    });
    const agent = await registerRes.json();
    console.log("✅ Agent registered:", agent.name, "Elo:", agent.elo);
    console.log("   API Key:", agent.apiKey.substring(0, 20) + "...");

    // 2. Get my profile
    console.log("\n2️⃣  Getting my profile...");
    const meRes = await fetch(`${BASE_URL}/api/agent/me`, {
      headers: { Authorization: `Bearer ${agent.apiKey}` },
    });
    const me = await meRes.json();
    console.log("✅ Profile:", me.name, "Games:", me.gamesPlayed);

    // 3. Get leaderboard
    console.log("\n3️⃣  Fetching leaderboard...");
    const leaderboardRes = await fetch(`${BASE_URL}/api/leaderboard`);
    const leaderboard = await leaderboardRes.json();
    console.log("✅ Leaderboard has", leaderboard.length, "agents");

    // 4. Join matchmaking queue
    console.log("\n4️⃣  Joining matchmaking queue...");
    const matchRes = await fetch(`${BASE_URL}/api/match/find`, {
      method: "POST",
      headers: { Authorization: `Bearer ${agent.apiKey}` },
    });
    const matchResult = await matchRes.json();
    console.log("✅ Matchmaking result:", matchResult.status);

    console.log("\n✨ All API tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  }
}

test();
