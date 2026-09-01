import { describe, it, expect } from "vitest"
import {
  calculateBuchholz,
  calculatePerformance,
  calculateSonnebornBerger,
  sortPlayersByStandings,
  standingsToCsv,
} from "@/lib/standings"
import { PAIRING_BYE_PLAYER_ID } from "@/lib/types"
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

    it("tiebreaker: same points and performance → higher Sonneborn-Berger wins", () => {
      // A and B both score 4 over 2 games (2.0 perf), but A beat a stronger opponent.
      const players = [
        player({
          id: "1",
          name: "A",
          score: 4,
          gamesPlayed: 2,
          opponentIds: ["strong", "weak"],
          gameResults: ["W", "W"],
        }),
        player({
          id: "2",
          name: "B",
          score: 4,
          gamesPlayed: 2,
          opponentIds: ["weak", "weak"],
          gameResults: ["W", "W"],
        }),
        player({ id: "strong", name: "Strong", score: 3, gamesPlayed: 5 }),
        player({ id: "weak", name: "Weak", score: 1, gamesPlayed: 5 }),
      ]
      const sorted = sortPlayersByStandings(players, "points")
      expect(sorted.map((p) => p.name).slice(0, 2)).toEqual(["A", "B"])
    })
  })

  describe("calculateBuchholz", () => {
    it("sums opponents' current scores", () => {
      const p = player({ id: "1", name: "A", opponentIds: ["o1", "o2"], gameResults: ["W", "L"] })
      const scoreById = new Map([["o1", 3], ["o2", 5]])
      expect(calculateBuchholz(p, scoreById)).toBe(8)
    })

    it("ignores pairing-bye opponents", () => {
      const p = player({
        id: "1",
        name: "A",
        opponentIds: ["o1", PAIRING_BYE_PLAYER_ID],
        gameResults: ["W", "W"],
      })
      const scoreById = new Map([["o1", 3]])
      expect(calculateBuchholz(p, scoreById)).toBe(3)
    })
  })

  describe("calculateSonnebornBerger", () => {
    it("counts full opponent score for wins, half for draws, none for losses", () => {
      const p = player({
        id: "1",
        name: "A",
        opponentIds: ["won", "drew", "lost"],
        gameResults: ["W", "D", "L"],
      })
      const scoreById = new Map([["won", 4], ["drew", 2], ["lost", 6]])
      // 4 (win) + 1 (half of drew's 2) + 0 (loss) = 5
      expect(calculateSonnebornBerger(p, scoreById)).toBe(5)
    })
  })

  describe("standingsToCsv", () => {
    it("renders a header row plus one row per ranked player", () => {
      const ranked = sortPlayersByStandings(
        [
          player({ id: "1", name: "High", score: 5, gamesPlayed: 2 }),
          player({ id: "2", name: "Low", score: 1, gamesPlayed: 2 }),
        ],
        "points",
      )
      const csv = standingsToCsv(ranked)
      const lines = csv.split("\n")
      expect(lines[0]).toBe("Rank,Name,Score,Games,Performance,Buchholz,Sonneborn-Berger")
      expect(lines[1]).toBe("1,High,5,2,2.50,0.0,0.0")
      expect(lines[2]).toBe("2,Low,1,2,0.50,0.0,0.0")
    })

    it("quotes names containing commas", () => {
      const csv = standingsToCsv([player({ id: "1", name: "Doe, Jane", score: 0, gamesPlayed: 0 })])
      expect(csv.split("\n")[1]).toBe('1,"Doe, Jane",0,0,0.00,0.0,0.0')
    })
  })
})
