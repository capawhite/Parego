import { describe, it, expect } from "vitest"
import { calculatePerformance, sortPlayersByStandings } from "@/lib/standings"
import type { Player } from "@/lib/types"

function player(overrides: Partial<Player> & { id: string; name: string }): Player {
  const { id, name, ...rest } = overrides
  return {
    id,
    name,
    score: 0,
    gamesPlayed: 0,
    streak: 0,
    performance: 0,
    active: true,
    paused: false,
    joinedAt: Date.now(),
    opponentIds: [],
    gameResults: [],
    pieceColors: [],
    ...rest,
  }
}

describe("leaderboard (standings update when results are submitted)", () => {
  describe("calculatePerformance", () => {
    it("returns 0 when no games played", () => {
      expect(calculatePerformance(player({ id: "1", name: "A", gamesPlayed: 0 }))).toBe(0)
    })

    it("returns points per game rounded to 2 decimals", () => {
      expect(calculatePerformance(player({ id: "1", name: "A", score: 6, gamesPlayed: 3 }))).toBe(2)
      expect(calculatePerformance(player({ id: "1", name: "A", score: 5, gamesPlayed: 3 }))).toBe(1.67)
    })
  })

  describe("sortPlayersByStandings", () => {
    it("sorts by points descending (points view)", () => {
      const players = [
        player({ id: "1", name: "Low", score: 1, gamesPlayed: 2 }),
        player({ id: "2", name: "High", score: 5, gamesPlayed: 2 }),
        player({ id: "3", name: "Mid", score: 3, gamesPlayed: 2 }),
      ]
      const sorted = sortPlayersByStandings(players, "points")
      expect(sorted.map((p) => p.name)).toEqual(["High", "Mid", "Low"])
    })

    it("tiebreaker: same points → by performance then games played", () => {
      const players = [
        player({ id: "1", name: "A", score: 4, gamesPlayed: 4 }), // 1.0, 4 games
        player({ id: "2", name: "B", score: 4, gamesPlayed: 2 }), // 2.0
        player({ id: "3", name: "C", score: 4, gamesPlayed: 2 }), // 2.0, same as B
      ]
      const sorted = sortPlayersByStandings(players, "points")
      expect(sorted[0].name).toBe("B")
      expect(sorted[1].name).toBe("C")
      expect(sorted[2].name).toBe("A")
    })

    it("performance view: sorts by points per game first", () => {
      const players = [
        player({ id: "1", name: "A", score: 2, gamesPlayed: 2 }), // 1.0
        player({ id: "2", name: "B", score: 6, gamesPlayed: 2 }), // 3.0
        player({ id: "3", name: "C", score: 4, gamesPlayed: 2 }), // 2.0
      ]
      const sorted = sortPlayersByStandings(players, "performance")
      expect(sorted.map((p) => p.name)).toEqual(["B", "C", "A"])
    })
  })
})
