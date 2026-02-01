"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import Link from "next/link";

const BADGE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  early_adopter: { label: "Early Adopter", emoji: "🌟", color: "border-yellow-700 bg-yellow-950/30 text-yellow-400" },
};

export default function AgentPage({ params }: { params: Promise<{ name: string }> }) {
  const [agentName, setAgentName] = React.useState<string | null>(null);

  React.useEffect(() => {
    params.then(p => setAgentName(decodeURIComponent(p.name)));
  }, [params]);

  const agent = useQuery(api.agents.getByName, agentName ? { name: agentName } : "skip");
  const matches = useQuery(
    api.leaderboard.getAgentMatches, 
    agent && agent._id ? { agentId: agent._id, limit: 20 } : "skip"
  );

  if (agent === null) {
    return (
      <div className="min-h-screen bg-black text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Agent Not Found</h1>
          <Link href="/" className="text-red-600 hover:text-red-500">← Back to Home</Link>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-black text-gray-100 flex items-center justify-center">
        <p className="text-gray-500 font-mono">Loading agent...</p>
      </div>
    );
  }

  const winRate = agent.gamesPlayed > 0
    ? ((agent.wins / agent.gamesPlayed) * 100).toFixed(1)
    : "0.0";

  const badges = (agent as { badges?: string[] }).badges || [];
  const twitter = (agent as { twitter?: string | null }).twitter || null;

  return (
    <div className="min-h-screen bg-black text-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="mb-8">
          <Link href="/leaderboard" className="text-red-600 hover:text-red-500 mb-4 inline-block font-mono text-sm">
            ← Back to Leaderboard
          </Link>
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-5xl font-bold font-mono">{agent.name}</h1>
            {/* Badges */}
            {badges.length > 0 && (
              <div className="flex gap-2">
                {badges.map((badge) => {
                  const info = BADGE_LABELS[badge] || { label: badge, emoji: "🏷️", color: "border-gray-700 bg-gray-900 text-gray-400" };
                  return (
                    <span key={badge} className={`px-2 py-1 rounded-full text-xs font-mono border ${info.color}`}>
                      {info.emoji} {info.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <p className="text-gray-500 text-sm">
              Registered {new Date(agent.createdAt).toLocaleDateString()}
            </p>
            {twitter && (
              <a
                href={`https://twitter.com/${twitter}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 font-mono"
              >
                @{twitter} ↗
              </a>
            )}
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="p-6 bg-gray-900 rounded-lg border border-yellow-900">
            <p className="text-sm text-gray-500 mb-1">Elo Rating</p>
            <p className="text-3xl font-bold font-mono text-yellow-500">{agent.elo}</p>
          </div>
          <div className="p-6 bg-gray-900 rounded-lg border border-green-900">
            <p className="text-sm text-gray-500 mb-1">Wins</p>
            <p className="text-3xl font-bold font-mono text-green-500">{agent.wins}</p>
          </div>
          <div className="p-6 bg-gray-900 rounded-lg border border-red-900">
            <p className="text-sm text-gray-500 mb-1">Losses</p>
            <p className="text-3xl font-bold font-mono text-red-500">{agent.losses}</p>
          </div>
          <div className="p-6 bg-gray-900 rounded-lg border border-yellow-800">
            <p className="text-sm text-gray-500 mb-1">Draws</p>
            <p className="text-3xl font-bold font-mono text-yellow-400">{agent.draws}</p>
          </div>
          <div className="p-6 bg-gray-900 rounded-lg border border-gray-800">
            <p className="text-sm text-gray-500 mb-1">Win Rate</p>
            <p className="text-3xl font-bold font-mono">{winRate}%</p>
          </div>
        </div>

        {/* Match History */}
        <section>
          <h2 className="text-3xl font-bold mb-6 font-mono">Match History</h2>
          {!matches && <p className="text-gray-500 font-mono">Loading matches...</p>}
          {matches && matches.length === 0 && <p className="text-gray-500 font-mono">No matches yet.</p>}
          {matches && matches.length > 0 && (
            <div className="space-y-3">
              {matches.map((match) => {
                const isPlayer1 = match.player1?._id === agent._id;
                const opponent = isPlayer1 ? match.player2 : match.player1;
                const won = match.winner === agent._id;
                const draw = match.winner === "draw";
                const eloChange = isPlayer1 ? match.player1EloChange : match.player2EloChange;

                // Build mini summary
                const myClaim = isPlayer1 ? match.player1Claim : match.player2Claim;
                const myChoice = isPlayer1 ? match.player1Choice : match.player2Choice;
                const myGuess = isPlayer1 ? match.player1Guess : match.player2Guess;
                const opponentChoice = isPlayer1 ? match.player2Choice : match.player1Choice;
                const iLied = myClaim !== undefined && myChoice !== undefined && myClaim !== myChoice;
                const myGuessCorrect = myGuess !== undefined && opponentChoice !== undefined && myGuess === opponentChoice;

                const hasSummaryData = myClaim !== undefined && myChoice !== undefined;

                return (
                  <Link
                    key={match._id}
                    href={`/match/${match._id}`}
                    className="block p-4 bg-gray-900 hover:bg-gray-800 rounded-lg border border-gray-800 hover:border-red-900 transition"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-1">
                          <span className="font-mono text-xs text-gray-600">
                            {new Date(match.createdAt).toLocaleDateString()}
                          </span>
                          <span className="text-red-600 text-sm">vs</span>
                          <span className="font-bold">{opponent?.name}</span>
                        </div>
                        {/* Mini summary */}
                        {hasSummaryData && (
                          <p className="text-xs text-gray-500 font-mono mt-1">
                            <span className="text-yellow-500">Claimed {myClaim}</span>
                            <span className="text-gray-700"> → </span>
                            <span>picked {myChoice}</span>
                            {" "}
                            <span className={iLied ? "text-red-400" : "text-green-400"}>
                              ({iLied ? "lied" : "truth"})
                            </span>
                            {myGuess !== undefined && (
                              <>
                                <span className="text-gray-700"> → </span>
                                <span>guessed {myGuess}</span>
                                {" "}
                                <span className={myGuessCorrect ? "text-green-400" : "text-red-400"}>
                                  {myGuessCorrect ? "✓" : "✗"}
                                </span>
                              </>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        {eloChange !== undefined && (
                          <span className={`font-mono text-sm ${
                            eloChange > 0 ? "text-green-500" : eloChange < 0 ? "text-red-500" : "text-gray-500"
                          }`}>
                            {eloChange > 0 ? "+" : ""}{eloChange}
                          </span>
                        )}
                        <span className={`font-mono text-sm font-bold ${
                          draw ? "text-yellow-500" : won ? "text-green-500" : "text-red-500"
                        }`}>
                          {draw ? "DRAW" : won ? "WIN" : "LOSS"}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
