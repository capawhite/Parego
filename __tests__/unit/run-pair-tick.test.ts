import { describe, it, expect } from "vitest"
import { runPairTick } from "@/lib/pairing/run-pair-tick"
import { DEFAULT_SETTINGS, type Player } from "@/lib/types"

function p(id: string): Player {
  return {
    id,
    name: id,
    score: 0,
    gamesPlayed: 0,
    streak: 0,
    performance: 0,
    active: true,
    paused: false,
    joinedAt: 0,
    opponentIds: [],
    gameResults: [],
    pieceColors: [],
    checkedInAt: Date.now(),
  }
}

describe("runPairTick", () => {
  it("returns empty for fide-swiss", () => {
    const out = runPairTick({
      players: [p("a"), p("b")],
      pairedMatches: [],
      allTimeMatches: [],
      settings: { ...DEFAULT_SETTINGS, pairingAlgorithm: "fide-swiss" },
      tableCount: 4,
      hasVenue: false,
    })
    expect(out.newMatches).toEqual([])
    expect(out.wouldPair).toBe(false)
  })

  it("can create pairings for all-vs-all with free tables", () => {
    const out = runPairTick({
      players: [p("a"), p("b"), p("c"), p("d")],
      pairedMatches: [],
      allTimeMatches: [],
      settings: { ...DEFAULT_SETTINGS, pairingAlgorithm: "all-vs-all", tableCount: 4 },
      tableCount: 4,
      hasVenue: false,
    })
    expect(out.wouldPair).toBe(true)
    expect(out.newMatches.length).toBeGreaterThan(0)
    for (const m of out.newMatches) {
      expect(m.tableNumber).toBeDefined()
    }
  })
})
