import { describe, expect, it } from "vitest"
import { computeArenaPairingInsights } from "@/lib/pairing/arena-pairing-insights"
import { DEFAULT_SETTINGS, type ArenaState, type Player } from "@/lib/types"

function player(overrides: Partial<Player> = {}): Player {
  return {
    id: "p1",
    name: "A",
    score: 0,
    gamesPlayed: 0,
    streak: 0,
    performance: 0,
    active: true,
    paused: false,
    joinedAt: 1,
    opponentIds: [],
    gameResults: [],
    pieceColors: [],
    ...overrides,
  }
}

function baseState(overrides: Partial<ArenaState> = {}): ArenaState {
  return {
    players: [],
    rounds: [],
    currentRound: null,
    pairedMatches: [],
    tournamentStartTime: 1000,
    tournamentDuration: 60 * 60 * 1000,
    isActive: true,
    allTimeMatches: [],
    tableCount: 2,
    settings: { ...DEFAULT_SETTINGS, pairingAlgorithm: "balanced-strength", tableCount: 2 },
    status: "active",
    ...overrides,
  }
}

describe("computeArenaPairingInsights", () => {
  it("counts T1-wait vs ready for Arena when one player just finished", () => {
    const end = 500_000
    const p1 = player({
      id: "a",
      name: "Alice",
      gameResults: ["W"],
      joinedAt: 0,
    })
    const p2 = player({ id: "b", name: "Bob", joinedAt: 0 })
    const match = {
      id: "m1",
      player1: p1,
      player2: p2,
      startTime: end - 2000,
      endTime: end,
      result: { isDraw: false, completed: true, completedAt: end },
    }
    const state = baseState({
      players: [p1, p2],
      allTimeMatches: [match],
      pairedMatches: [],
      tableCount: 2,
      settings: {
        ...DEFAULT_SETTINGS,
        pairingAlgorithm: "balanced-strength",
        tableCount: 2,
        baseTimeMinutes: 5,
        incrementSeconds: 0,
      },
    })
    const now = end + 1000
    const ins = computeArenaPairingInsights({
      state,
      nowMs: now,
      tournamentMetadata: null,
      isActive: true,
      waitingForFinalResults: false,
    })
    expect(ins.usesT1).toBe(true)
    const alice = ins.players.find((p) => p.id === "a")
    const bob = ins.players.find((p) => p.id === "b")
    expect(alice?.status === "t1_wait" || bob?.status === "t1_wait").toBe(true)
    expect(ins.t1EligibleIdleCount).toBeLessThan(2)
  })

  it("All vs All does not use T1 in insights", () => {
    const p1 = player({ id: "a", name: "A" })
    const p2 = player({ id: "b", name: "B" })
    const state = baseState({
      players: [p1, p2],
      settings: { ...DEFAULT_SETTINGS, pairingAlgorithm: "all-vs-all", tableCount: 2 },
    })
    const ins = computeArenaPairingInsights({
      state,
      nowMs: Date.now(),
      tournamentMetadata: null,
      isActive: true,
      waitingForFinalResults: false,
    })
    expect(ins.usesT1).toBe(false)
    expect(ins.players.every((p) => p.status !== "t1_wait")).toBe(true)
  })
})
