import { describe, it, expect } from "vitest";
import { calculateElo } from "../convex/elo";

describe("calculateElo", () => {
  it("returns +16 for equal-rated win", () => {
    const change = calculateElo(1200, 1200, 1);
    expect(change).toBe(16);
  });

  it("returns -16 for equal-rated loss", () => {
    const change = calculateElo(1200, 1200, 0);
    expect(change).toBe(-16);
  });

  it("returns 0 for equal-rated draw", () => {
    const change = calculateElo(1200, 1200, 0.5);
    expect(change).toBe(0);
  });

  it("rewards upset wins more", () => {
    // Underdog (1000) beats favorite (1400)
    const underdogWin = calculateElo(1000, 1400, 1);
    const favoriteWin = calculateElo(1400, 1000, 1);
    expect(underdogWin).toBeGreaterThan(favoriteWin);
  });

  it("punishes upset losses more", () => {
    // Favorite (1400) loses to underdog (1000)
    const favoriteLoss = calculateElo(1400, 1000, 0);
    const underdogLoss = calculateElo(1000, 1400, 0);
    expect(Math.abs(favoriteLoss)).toBeGreaterThan(Math.abs(underdogLoss));
  });

  it("changes are symmetric (zero-sum)", () => {
    const winnerChange = calculateElo(1200, 1200, 1);
    const loserChange = calculateElo(1200, 1200, 0);
    expect(winnerChange + loserChange).toBe(0);
  });

  it("changes are symmetric for unequal ratings", () => {
    const winnerChange = calculateElo(1300, 1100, 1);
    const loserChange = calculateElo(1100, 1300, 0);
    expect(winnerChange + loserChange).toBe(0);
  });

  it("K=32 means max change is 32", () => {
    // Massive underdog wins
    const maxChange = calculateElo(400, 2800, 1);
    expect(maxChange).toBeLessThanOrEqual(32);
    expect(maxChange).toBeGreaterThanOrEqual(31); // nearly 32
  });
});
