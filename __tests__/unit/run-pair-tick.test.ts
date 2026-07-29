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
  it("returns empty for swiss", () => {
    const out = runPairTick({
      players: [p("a"), p("b")],
      pairedMatches: [],
      allTimeMatches: [],
      settings: { ...DEFAULT_SETTINGS, pairingAlgorithm: "swiss" },
      tableCount: 4,
      hasVenue: false,
    })
    expect(out.newMatches).toEqual([])
    expect(out.wouldPair).toBe(false)
  })

  it("returns empty for legacy fide-swiss", () => {
    const out = runPairTick({
      players: [p("a"), p("b"), p("c"), p("d")],
      pairedMatches: [],
      allTimeMatches: [],
      settings: { ...DEFAULT_SETTINGS, pairingAlgorithm: "fide-swiss" },
      tableCount: 4,
      hasVenue: false,
    })
    expect(out.wouldPair).toBe(false)
    expect(out.newMatches).toEqual([])
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

  it("does not pair when all tables are occupied", () => {
    const a = p("a")
    const b = p("b")
    const out = runPairTick({
      players: [a, b, p("c"), p("d")],
      pairedMatches: [
        {
          id: "busy1",
          player1: a,
          player2: b,
          tableNumber: 1,
        },
        {
          id: "busy2",
          player1: p("e"),
          player2: p("f"),
          tableNumber: 2,
        },
      ],
      allTimeMatches: [],
      settings: { ...DEFAULT_SETTINGS, pairingAlgorithm: "all-vs-all", tableCount: 2 },
      tableCount: 2,
      hasVenue: false,
    })
    expect(out.wouldPair).toBe(false)
    expect(out.newMatches).toEqual([])
  })

  it("excludes unchecked-in players when venue is required", () => {
    const out = runPairTick({
      players: [
        { ...p("a"), checkedInAt: undefined },
        { ...p("b"), checkedInAt: undefined },
        { ...p("c"), checkedInAt: undefined },
        { ...p("d"), checkedInAt: undefined },
      ],
      pairedMatches: [],
      allTimeMatches: [],
      settings: { ...DEFAULT_SETTINGS, pairingAlgorithm: "all-vs-all", tableCount: 4 },
      tableCount: 4,
      hasVenue: true,
    })
    expect(out.wouldPair).toBe(false)
    expect(out.newMatches).toEqual([])
  })

  it("drops matches involving players already active in DB", () => {
    const out = runPairTick({
      players: [p("a"), p("b"), p("c"), p("d")],
      pairedMatches: [],
      allTimeMatches: [],
      settings: { ...DEFAULT_SETTINGS, pairingAlgorithm: "all-vs-all", tableCount: 4 },
      tableCount: 4,
      hasVenue: false,
      dbActivePlayerIds: new Set(["a", "b", "c", "d"]),
    })
    expect(out.wouldPair).toBe(true)
    expect(out.newMatches).toEqual([])
  })
})
