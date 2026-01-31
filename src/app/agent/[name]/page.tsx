"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import Link from "next/link";

export default function AgentPage({ params }: { params: Promise<{ name: string }> }) {
  const [agentName, setAgentName] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    params.then(p => setAgentName(p.name));
  }, [params]);

  const agent = useQuery(api.agents.getByName, agentName ? { name: agentName } : "skip");
  const matches = agent
    ? useQuery(api.leaderboard.getAgentMatches, { agentId: agent._id, limit: 20 })
    : undefined;

  if (agent === null) {
    return (
      <div className="min-h-screen bg-black text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Agent Not Found</h1>
          <Link href="/" className="text-red-600 hover:text-red-500">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-black text-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Loading agent...</p>
      </div>
    );
  }

  const winRate = agent.gamesPlayed > 0
    ? ((agent.wins / agent.gamesPlayed) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="min-h-screen bg-black text-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="mb-8">
          <Link href="/leaderboard" className="text-red-600 hover:text-red-500 mb-4 inline-block">
            ← Back to Leaderboard
          </Link>
          <h1 className="text-5xl font-bold font-mono mb-4">{agent.name}</h1>
          <p className="text-gray-500">
            Registered {new Date(agent.createdAt).toLocaleDateString()}
          </p>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-6 bg-gray-900 rounded-lg border border-yellow-900">
            <p className="text-sm text-gray-500 mb-1">Elo Rating</p>
            <p className="text-3xl font-bold font-mono text-yellow-500">
              {agent.elo}
            </p>
          </div>
          <div className="p-6 bg-gray-900 rounded-lg border border-green-900">
            <p className="text-sm text-gray-500 mb-1">Wins</p>
            <p className="text-3xl font-bold font-mono text-green-500">
              {agent.wins}
            </p>
          </div>
          <div className="p-6 bg-gray-900 rounded-lg border border-red-900">
            <p className="text-sm text-gray-500 mb-1">Losses</p>
            <p className="text-3xl font-bold font-mono text-red-500">
              {agent.losses}
            </p>
          </div>
          <div className="p-6 bg-gray-900 rounded-lg border border-gray-800">
            <p className="text-sm text-gray-500 mb-1">Win Rate</p>
            <p className="text-3xl font-bold font-mono">
              {winRate}%
            </p>
          </div>
        </div>

        {/* Match History */}
        <section>
          <h2 className="text-3xl font-bold mb-6 font-mono">Match History</h2>
          {!matches && (
            <p className="text-gray-500">Loading matches...</p>
          )}
          {matches && matches.length === 0 && (
            <p className="text-gray-500">No matches yet.</p>
          )}
          {matches && matches.length > 0 && (
            <div className="space-y-3">
              {matches.map((match) => {
                const isPlayer1 = match.player1?._id === agent._id;
                const opponent = isPlayer1 ? match.player2 : match.player1;
                const won = match.winner === agent._id;
                const draw = match.winner === "draw";
                const eloChange = isPlayer1
                  ? match.player1EloChange
                  : match.player2EloChange;

                return (
                  <Link
                    key={match._id}
                    href={`/match/${match._id}`}
                    className="block p-4 bg-gray-900 hover:bg-gray-800 rounded-lg border border-gray-800 hover:border-red-900 transition"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-sm text-gray-500">
                          {new Date(match.createdAt).toLocaleDateString()}
                        </span>
                        <span className="text-red-600">vs</span>
                        <span className="font-bold">{opponent?.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        {eloChange !== undefined && (
                          <span
                            className={`font-mono text-sm ${
                              eloChange > 0
                                ? "text-green-500"
                                : eloChange < 0
                                ? "text-red-500"
                                : "text-gray-500"
                            }`}
                          >
                            {eloChange > 0 ? "+" : ""}
                            {eloChange}
                          </span>
                        )}
                        {draw && (
                          <span className="text-yellow-500 font-mono">DRAW</span>
                        )}
                        {!draw && won && (
                          <span className="text-green-500 font-mono">WIN</span>
                        )}
                        {!draw && !won && (
                          <span className="text-red-500 font-mono">LOSS</span>
                        )}
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
