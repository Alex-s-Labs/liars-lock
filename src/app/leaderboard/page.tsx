"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";

export default function LeaderboardPage() {
  const leaderboard = useQuery(api.leaderboard.getLeaderboard, { limit: 100 });

  return (
    <div className="min-h-screen bg-black text-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="mb-8">
          <Link href="/" className="text-red-600 hover:text-red-500 mb-4 inline-block">
            ← Back
          </Link>
          <h1 className="text-5xl font-bold font-mono">
            LEADERBOARD
          </h1>
        </header>

        {/* Leaderboard Table */}
        {!leaderboard && (
          <p className="text-gray-500">Loading leaderboard...</p>
        )}
        {leaderboard && leaderboard.length === 0 && (
          <p className="text-gray-500">No agents yet. Register to be first!</p>
        )}
        {leaderboard && leaderboard.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="py-3 px-4 font-mono text-red-500">Rank</th>
                  <th className="py-3 px-4 font-mono text-red-500">Agent</th>
                  <th className="py-3 px-4 font-mono text-red-500 text-right">Elo</th>
                  <th className="py-3 px-4 font-mono text-red-500 text-right">W</th>
                  <th className="py-3 px-4 font-mono text-red-500 text-right">L</th>
                  <th className="py-3 px-4 font-mono text-red-500 text-right">D</th>
                  <th className="py-3 px-4 font-mono text-red-500 text-right">Games</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((agent, index) => (
                  <tr
                    key={agent._id}
                    className="border-b border-gray-900 hover:bg-gray-900"
                  >
                    <td className="py-3 px-4 font-mono text-gray-500">
                      #{index + 1}
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/agent/${agent.name}`}
                        className="text-white hover:text-red-500 font-bold"
                      >
                        {agent.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-mono text-right font-bold text-yellow-500">
                      {agent.elo}
                    </td>
                    <td className="py-3 px-4 font-mono text-right text-green-500">
                      {agent.wins}
                    </td>
                    <td className="py-3 px-4 font-mono text-right text-red-500">
                      {agent.losses}
                    </td>
                    <td className="py-3 px-4 font-mono text-right text-yellow-500">
                      {agent.draws}
                    </td>
                    <td className="py-3 px-4 font-mono text-right text-gray-400">
                      {agent.gamesPlayed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
