// Full game simulation between two bots
const crypto = require("crypto");
const BASE_URL = "http://localhost:3000";

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playAsAgent(name, apiKey, matchId, choice) {
  console.log(`\n🤖 ${name} starting game...`);

  // 1. Commit
  const nonce = crypto.randomBytes(16).toString("hex");
  const hash = sha256(`${choice}:${nonce}`);
  console.log(`  ${name}: Committing choice=${choice}, hash=${hash.substring(0, 16)}...`);

  await fetch(`${BASE_URL}/api/match/${matchId}/commit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ hash }),
  });

  // Wait for both commits
  await delay(1000);

  // 2. Message
  const message = Math.random() > 0.5 ? `I picked ${choice}` : `I picked ${1 - choice}`;
  console.log(`  ${name}: Sending message: "${message}"`);

  await fetch(`${BASE_URL}/api/match/${matchId}/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ message }),
  });

  // Wait for both messages
  await delay(1000);

  // Check opponent's message
  const stateRes = await fetch(`${BASE_URL}/api/match/${matchId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const state = await stateRes.json();
  const opponentMessage = state.player1?.name === name ? state.player2Message : state.player1Message;
  if (opponentMessage) {
    console.log(`  ${name}: Opponent said: "${opponentMessage}"`);
  }

  // 3. Guess (simple strategy: believe opponent if they seem confident)
  const guess = Math.random() > 0.5 ? 0 : 1;
  console.log(`  ${name}: Guessing opponent picked ${guess}`);

  await fetch(`${BASE_URL}/api/match/${matchId}/guess`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ guess }),
  });

  // Wait for both guesses
  await delay(1000);

  // 4. Reveal
  console.log(`  ${name}: Revealing choice=${choice}, nonce=${nonce.substring(0, 16)}...`);

  await fetch(`${BASE_URL}/api/match/${matchId}/reveal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ choice, nonce }),
  });

  return { choice, guess };
}

async function test() {
  console.log("🎮 Testing Full Game Flow...\n");

  try {
    // Register two agents
    console.log("1️⃣  Registering agents...");
    const agent1Res = await fetch(`${BASE_URL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Bot1_${Date.now()}` }),
    });
    const agent1 = await agent1Res.json();

    const agent2Res = await fetch(`${BASE_URL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Bot2_${Date.now()}` }),
    });
    const agent2 = await agent2Res.json();

    console.log(`✅ ${agent1.name} (Elo ${agent1.elo})`);
    console.log(`✅ ${agent2.name} (Elo ${agent2.elo})`);

    // Find match for both
    console.log("\n2️⃣  Matchmaking...");
    const match1Res = await fetch(`${BASE_URL}/api/match/find`, {
      method: "POST",
      headers: { Authorization: `Bearer ${agent1.apiKey}` },
    });
    const match1 = await match1Res.json();

    const match2Res = await fetch(`${BASE_URL}/api/match/find`, {
      method: "POST",
      headers: { Authorization: `Bearer ${agent2.apiKey}` },
    });
    const match2 = await match2Res.json();

    const matchId = match1.matchId || match2.matchId;
    console.log(`✅ Match created: ${matchId}`);
    console.log(`   ${match1.opponentName || match2.opponentName} vs ${match2.opponentName || match1.opponentName}`);

    // Play the game
    console.log("\n3️⃣  Playing game...");
    const choice1 = Math.random() > 0.5 ? 0 : 1;
    const choice2 = Math.random() > 0.5 ? 0 : 1;

    await Promise.all([
      playAsAgent(agent1.name, agent1.apiKey, matchId, choice1),
      playAsAgent(agent2.name, agent2.apiKey, matchId, choice2),
    ]);

    // Wait for match to complete
    await delay(2000);

    // Check results
    console.log("\n4️⃣  Match results...");
    const finalRes = await fetch(`${BASE_URL}/api/match/${matchId}`);
    const final = await finalRes.json();

    console.log(`\n📊 Final Results:`);
    if (final.player1 && final.player2) {
      console.log(`   ${final.player1.name}: choice=${final.player1Choice}, guess=${final.player1Guess}`);
      console.log(`   ${final.player2.name}: choice=${final.player2Choice}, guess=${final.player2Guess}`);
      console.log(`\n   Winner: ${final.winner === "draw" ? "DRAW" : (final.winner === final.player1._id ? final.player1.name : final.player2.name)}`);
      console.log(`   ${final.player1.name} Elo change: ${final.player1EloChange > 0 ? "+" : ""}${final.player1EloChange}`);
      console.log(`   ${final.player2.name} Elo change: ${final.player2EloChange > 0 ? "+" : ""}${final.player2EloChange}`);
    } else {
      console.log("   Match state:", JSON.stringify(final, null, 2));
    }

    console.log("\n✨ Full game test passed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error);
    process.exit(1);
  }
}

test();
