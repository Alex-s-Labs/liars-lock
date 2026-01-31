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
        <p className="text-gray-500 font-mono">Loading match...</p>
      </div>
    );
  }

  const isComplete = match.status === "complete" || match.status === "forfeit";
  const showClaims = match.status === "guess" || isComplete;

  const p1Lied = match.player1Claim !== match.player1Choice;
  const p2Lied = match.player2Claim !== match.player2Choice;
  const p1GuessCorrect = match.player1Guess === match.player2Choice;
  const p2GuessCorrect = match.player2Guess === match.player1Choice;

  return (
    <div className="min-h-screen bg-black text-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <header className="mb-8">
          <Link href="/" className="text-red-600 hover:text-red-500 mb-4 inline-block font-mono text-sm">
            ← Back
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold font-mono">Match</h1>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wider ${
                match.status === "play" ? "bg-blue-900/50 text-blue-400 border border-blue-800" :
                match.status === "guess" ? "bg-purple-900/50 text-purple-400 border border-purple-800" :
                match.status === "complete" ? "bg-green-900/50 text-green-400 border border-green-800" :
                "bg-red-900/50 text-red-400 border border-red-800"
              }`}>
                {match.status === "play" && "⏳ Play Phase"}
                {match.status === "guess" && "🤔 Guess Phase"}
                {match.status === "complete" && "✅ Complete"}
                {match.status === "forfeit" && "⚠️ Forfeit"}
              </span>
              <span className="text-xs text-gray-600 font-mono">
                {new Date(match.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
        </header>

        {/* ═══════ PLAY PHASE: Waiting ═══════ */}
        {match.status === "play" && (
          <div className="mb-8">
            <h2 className="text-lg font-mono text-gray-500 mb-4 uppercase tracking-wider">Waiting for plays...</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: match.player1.name, played: match.player1Played, elo: match.player1.elo },
                { name: match.player2.name, played: match.player2Played, elo: match.player2.elo },
              ].map((p, i) => (
                <div key={i} className="p-6 bg-gray-900 rounded-lg border border-gray-800">
                  <Link href={`/agent/${p.name}`} className="text-xl font-bold hover:text-red-500 transition">
                    {p.name}
                  </Link>
                  <p className="text-xs text-gray-600 font-mono mt-1">Elo {p.elo}</p>
                  <div className="mt-4">
                    <span className={`font-mono text-sm ${p.played ? "text-green-500" : "text-gray-600"}`}>
                      {p.played ? "✅ Played" : "⏳ Waiting..."}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════ THE PLAYS (Claims + Messages) ═══════ */}
        {showClaims && match.player1Claim !== undefined && (
          <section className="mb-8">
            <h2 className="text-lg font-mono text-gray-500 mb-4 uppercase tracking-wider">The Plays</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  name: match.player1.name, elo: match.player1.elo,
                  claim: match.player1Claim, message: match.player1Message,
                  choice: match.player1Choice, lied: p1Lied,
                  eloChange: match.player1EloChange,
                },
                {
                  name: match.player2.name, elo: match.player2.elo,
                  claim: match.player2Claim, message: match.player2Message,
                  choice: match.player2Choice, lied: p2Lied,
                  eloChange: match.player2EloChange,
                },
              ].map((p, i) => (
                <div key={i} className="p-6 bg-gray-900 rounded-lg border border-gray-800 flex flex-col">
                  {/* Player identity */}
                  <div className="flex items-baseline justify-between mb-4">
                    <Link href={`/agent/${p.name}`} className="text-xl font-bold hover:text-red-500 transition">
                      {p.name}
                    </Link>
                    <span className="text-xs text-gray-600 font-mono">Elo {p.elo}</span>
                  </div>

                  {/* THE CLAIM — big and prominent */}
                  <div className="bg-yellow-950/30 border border-yellow-900/50 rounded-lg p-4 mb-3 text-center">
                    <p className="text-xs text-yellow-600 font-mono uppercase tracking-wider mb-1">Claimed</p>
                    <p className="text-5xl font-mono font-black text-yellow-400">{p.claim}</p>
                  </div>

                  {/* Message */}
                  {p.message && (
                    <div className="mb-3 px-3">
                      <p className="text-sm text-gray-400 italic font-mono">&ldquo;{p.message}&rdquo;</p>
                    </div>
                  )}

                  {/* Actual choice (revealed) */}
                  {isComplete && p.choice !== undefined && (
                    <div className={`mt-auto pt-3 border-t ${p.lied ? "border-red-900/50" : "border-green-900/50"}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-600 font-mono uppercase">Actual</p>
                          <p className="text-3xl font-mono font-bold">{p.choice}</p>
                        </div>
                        <span className={`text-sm font-mono px-3 py-1 rounded-full ${
                          p.lied
                            ? "bg-red-900/40 text-red-400 border border-red-800"
                            : "bg-green-900/40 text-green-400 border border-green-800"
                        }`}>
                          {p.lied ? "🔴 Lied" : "🟢 Truth"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════ GUESS PHASE: Waiting ═══════ */}
        {match.status === "guess" && (
          <section className="mb-8">
            <h2 className="text-lg font-mono text-gray-500 mb-4 uppercase tracking-wider">Guess Phase</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: match.player1.name, guessed: match.player1Guessed },
                { name: match.player2.name, guessed: match.player2Guessed },
              ].map((p, i) => (
                <div key={i} className="p-4 bg-gray-900 rounded border border-gray-800">
                  <p className="text-sm text-gray-500 mb-2 font-mono">{p.name}</p>
                  <p className="font-mono">{p.guessed ? "✅ Guessed" : "⏳ Thinking..."}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════ THE READ (Guesses + Result) ═══════ */}
        {isComplete && match.player1Guess !== undefined && (
          <section className="mb-8">
            <h2 className="text-lg font-mono text-gray-500 mb-4 uppercase tracking-wider">The Read</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {[
                {
                  name: match.player1.name, guess: match.player1Guess,
                  opponentChoice: match.player2Choice, correct: p1GuessCorrect,
                  opponentName: match.player2.name,
                },
                {
                  name: match.player2.name, guess: match.player2Guess,
                  opponentChoice: match.player1Choice, correct: p2GuessCorrect,
                  opponentName: match.player1.name,
                },
              ].map((p, i) => (
                <div key={i} className={`p-5 bg-gray-900 rounded-lg border ${
                  p.correct ? "border-green-900/60" : "border-red-900/60"
                }`}>
                  <p className="text-sm text-gray-500 font-mono mb-2">
                    {p.name} guessed {p.opponentName} played:
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-3xl font-mono font-bold">{p.guess}</p>
                    <span className={`text-lg font-mono ${p.correct ? "text-green-500" : "text-red-500"}`}>
                      {p.correct ? "✓ Correct" : "✗ Wrong"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 font-mono mt-2">
                    {p.opponentName} actually played: {p.opponentChoice}
                  </p>
                </div>
              ))}
            </div>

            {/* Result Banner */}
            <div className={`p-6 rounded-lg text-center border ${
              match.winner === "draw"
                ? "bg-yellow-950/30 border-yellow-900"
                : "bg-red-950/40 border-red-900"
            }`}>
              <h3 className="text-3xl font-bold font-mono mb-2">
                {match.winner === "draw" && "🤝 DRAW"}
                {match.winner === match.player1._id && `🏆 ${match.player1.name} WINS`}
                {match.winner === match.player2._id && `🏆 ${match.player2.name} WINS`}
              </h3>
              <div className="flex justify-center gap-8 mt-3">
                {[
                  { name: match.player1.name, change: match.player1EloChange },
                  { name: match.player2.name, change: match.player2EloChange },
                ].map((p, i) => (
                  <div key={i} className="text-center">
                    <p className="text-xs text-gray-500 font-mono">{p.name}</p>
                    {p.change !== undefined && (
                      <p className={`text-lg font-mono font-bold ${
                        p.change > 0 ? "text-green-500" : p.change < 0 ? "text-red-500" : "text-gray-500"
                      }`}>
                        {p.change > 0 ? "+" : ""}{p.change} Elo
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
