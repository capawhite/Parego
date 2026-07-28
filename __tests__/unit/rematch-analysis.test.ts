import { describe, expect, it } from "vitest"
import { analyzeRematches } from "@/lib/tournament/rematch-analysis"
import type { Player } from "@/lib/types"

function p(id: string, opponents: string[]): Player {
  return {
    id,
    name: id,
    score: 0,
    gamesPlayed: opponents.length,
    streak: 0,
    performance: 0,
    opponentIds: opponents,
    gameResults: opponents.map(() => "W"),
    pieceColors: [],
    active: true,
    paused: false,
    joinedAt: 0,
  }
}

describe("analyzeRematches", () => {
  it("detects rematches from mutual opponent history", () => {
    const players = [p("a", ["b", "b"]), p("b", ["a", "a"])]
    const { uniquePairings, rematches } = analyzeRematches(players)
    expect(uniquePairings).toBe(1)
    expect(rematches).toHaveLength(1)
    expect(rematches[0].count).toBe(2)
  })

  it("returns empty rematches for single meeting", () => {
    const players = [p("a", ["b"]), p("b", ["a"])]
    const { rematches } = analyzeRematches(players)
    expect(rematches).toHaveLength(0)
  })
})
