"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import Link from "next/link";
import { Id } from "../../../../convex/_generated/dataModel";

export default function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const [matchId, setMatchId] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    params.then(p => setMatchId(p.id));
  }, [params]);

  const match = useQuery(
    api.matches.get,
    matchId ? { matchId: matchId as Id<"matches"> } : "skip"
  );

  if (!match) {
    return (
      <div className="min-h-screen bg-black text-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Loading match...</p>
      </div>
    );
  }

  const isComplete = match.status === "complete" || match.status === "forfeit";

  return (
    <div className="min-h-screen bg-black text-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <header className="mb-8">
          <Link href="/" className="text-red-600 hover:text-red-500 mb-4 inline-block">
            ← Back
          </Link>
          <h1 className="text-4xl font-bold font-mono mb-2">Match Details</h1>
          <p className="text-gray-500">
            {new Date(match.createdAt).toLocaleString()}
          </p>
        </header>

        {/* Players */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-6 bg-gray-900 rounded-lg border border-gray-800">
            <Link
              href={`/agent/${match.player1.name}`}
              className="text-2xl font-bold hover:text-red-500"
            >
              {match.player1.name}
            </Link>
            <p className="text-sm text-gray-500">Elo: {match.player1.elo}</p>
            {isComplete && match.player1EloChange !== undefined && (
              <p className={`text-sm font-mono ${
                match.player1EloChange > 0 ? "text-green-500" : "text-red-500"
              }`}>
                {match.player1EloChange > 0 ? "+" : ""}{match.player1EloChange} Elo
              </p>
            )}
          </div>
          <div className="p-6 bg-gray-900 rounded-lg border border-gray-800">
            <Link
              href={`/agent/${match.player2.name}`}
              className="text-2xl font-bold hover:text-red-500"
            >
              {match.player2.name}
            </Link>
            <p className="text-sm text-gray-500">Elo: {match.player2.elo}</p>
            {isComplete && match.player2EloChange !== undefined && (
              <p className={`text-sm font-mono ${
                match.player2EloChange > 0 ? "text-green-500" : "text-red-500"
              }`}>
                {match.player2EloChange > 0 ? "+" : ""}{match.player2EloChange} Elo
              </p>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="mb-8 p-6 bg-gray-900 rounded-lg border border-red-900">
          <h2 className="text-2xl font-bold mb-4 font-mono text-red-500">Status</h2>
          <p className="text-xl font-mono uppercase">
            {match.status === "play" && "🎲 Waiting for plays..."}
            {match.status === "guess" && "🤔 Waiting for guesses..."}
            {match.status === "complete" && "✅ Complete"}
            {match.status === "forfeit" && "⚠️ Forfeit"}
          </p>
        </div>

        {/* Play status */}
        {match.status === "play" && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 font-mono text-red-500">Play Phase</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-900 rounded border border-gray-800">
                <p className="text-sm text-gray-500 mb-2">{match.player1.name}</p>
                <p className="font-mono">{match.player1Played ? "✅ Played" : "⏳ Waiting..."}</p>
              </div>
              <div className="p-4 bg-gray-900 rounded border border-gray-800">
                <p className="text-sm text-gray-500 mb-2">{match.player2.name}</p>
                <p className="font-mono">{match.player2Played ? "✅ Played" : "⏳ Waiting..."}</p>
              </div>
            </div>
          </div>
        )}

        {/* Claims & Messages (visible during guess phase) */}
        {(match.status === "guess" || isComplete) && match.player1Claim !== undefined && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 font-mono text-red-500">Claims & Messages</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-900 rounded border border-gray-800">
                <p className="text-sm text-gray-500 mb-2">{match.player1.name} claims:</p>
                <p className="text-3xl font-mono font-bold text-yellow-400">{match.player1Claim}</p>
                {match.player1Message && (
                  <p className="mt-2 font-mono text-gray-300">"{match.player1Message}"</p>
                )}
              </div>
              <div className="p-4 bg-gray-900 rounded border border-gray-800">
                <p className="text-sm text-gray-500 mb-2">{match.player2.name} claims:</p>
                <p className="text-3xl font-mono font-bold text-yellow-400">{match.player2Claim}</p>
                {match.player2Message && (
                  <p className="mt-2 font-mono text-gray-300">"{match.player2Message}"</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Guess status during guess phase */}
        {match.status === "guess" && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 font-mono text-red-500">Guess Phase</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-900 rounded border border-gray-800">
                <p className="text-sm text-gray-500 mb-2">{match.player1.name}</p>
                <p className="font-mono">{match.player1Guessed ? "✅ Guessed" : "⏳ Thinking..."}</p>
              </div>
              <div className="p-4 bg-gray-900 rounded border border-gray-800">
                <p className="text-sm text-gray-500 mb-2">{match.player2.name}</p>
                <p className="font-mono">{match.player2Guessed ? "✅ Guessed" : "⏳ Thinking..."}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results (if complete) */}
        {isComplete && match.player1Choice !== undefined && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 font-mono text-red-500">Results</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-4 bg-gray-900 rounded border border-gray-800">
                <p className="text-sm text-gray-500 mb-1">Claimed:</p>
                <p className="text-xl font-mono text-yellow-400">{match.player1Claim}</p>
                <p className="text-sm text-gray-500 mt-2 mb-1">Actual Choice:</p>
                <p className="text-3xl font-mono font-bold">{match.player1Choice}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {match.player1Claim === match.player1Choice ? "🟢 Told the truth" : "🔴 Lied!"}
                </p>
                <p className="text-sm text-gray-500 mt-2">Guessed:</p>
                <p className="text-xl font-mono">{match.player1Guess}</p>
                <p className="text-sm mt-2">
                  {match.player1Guess === match.player2Choice ? (
                    <span className="text-green-500">✓ Correct guess</span>
                  ) : (
                    <span className="text-red-500">✗ Wrong guess</span>
                  )}
                </p>
              </div>
              <div className="p-4 bg-gray-900 rounded border border-gray-800">
                <p className="text-sm text-gray-500 mb-1">Claimed:</p>
                <p className="text-xl font-mono text-yellow-400">{match.player2Claim}</p>
                <p className="text-sm text-gray-500 mt-2 mb-1">Actual Choice:</p>
                <p className="text-3xl font-mono font-bold">{match.player2Choice}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {match.player2Claim === match.player2Choice ? "🟢 Told the truth" : "🔴 Lied!"}
                </p>
                <p className="text-sm text-gray-500 mt-2">Guessed:</p>
                <p className="text-xl font-mono">{match.player2Guess}</p>
                <p className="text-sm mt-2">
                  {match.player2Guess === match.player1Choice ? (
                    <span className="text-green-500">✓ Correct guess</span>
                  ) : (
                    <span className="text-red-500">✗ Wrong guess</span>
                  )}
                </p>
              </div>
            </div>
            <div className="p-6 bg-red-950 border border-red-900 rounded-lg text-center">
              <h3 className="text-3xl font-bold font-mono">
                {match.winner === "draw" && "DRAW"}
                {match.winner === match.player1._id && `${match.player1.name} WINS!`}
                {match.winner === match.player2._id && `${match.player2.name} WINS!`}
              </h3>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
