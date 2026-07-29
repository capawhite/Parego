import { describe, it, expect } from "vitest"
import { applyMatchResultToState } from "@/lib/tournament/apply-match-result"
import { mergeMatchesForSave, assignTablesToMatchesForState } from "@/lib/tournament/merge-matches"
import { DEFAULT_SETTINGS, PAIRING_BYE_PLAYER_ID, type ArenaState, type Match, type Player } from "@/lib/types"

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
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
    pointsEarned: [],
    tableNumbers: [],
    ...overrides,
  }
}

function makeMatch(id: string, p1: Player, p2: Player, overrides: Partial<Match> = {}): Match {
  return {
    id,
    player1: p1,
    player2: p2,
    tableNumber: 1,
    ...overrides,
  }
}

describe("applyMatchResultToState", () => {
  it("applies win/loss history once", () => {
    const p1 = makePlayer("a")
    const p2 = makePlayer("b")
    const match = makeMatch("m1", p1, p2)
    const out = applyMatchResultToState({
      pairedMatches: [match],
      allTimeMatches: [],
      players: [p1, p2],
      settings: { ...DEFAULT_SETTINGS, streakEnabled: false },
      matchId: "m1",
      winnerId: "a",
      isDraw: false,
      removeCompletedFromPaired: true,
    })
    expect(out.ok).toBe(true)
    expect(out.players.find((p) => p.id === "a")?.score).toBe(DEFAULT_SETTINGS.winPoints)
    expect(out.players.find((p) => p.id === "b")?.score).toBe(DEFAULT_SETTINGS.lossPoints)
    expect(out.players.find((p) => p.id === "a")?.opponentIds).toEqual(["b"])
    expect(out.players.find((p) => p.id === "a")?.pieceColors).toEqual(["white"])
    expect(out.pairedMatches).toHaveLength(0)
    expect(out.allTimeMatches).toHaveLength(1)
  })

  it("is idempotent when already completed", () => {
    const p1 = makePlayer("a")
    const p2 = makePlayer("b")
    const match: Match = {
      ...makeMatch("m1", p1, p2),
      result: { isDraw: false, completed: true, completedAt: 1, winnerId: "a" },
    }
    const out = applyMatchResultToState({
      pairedMatches: [match],
      allTimeMatches: [],
      players: [p1, p2],
      settings: DEFAULT_SETTINGS,
      matchId: "m1",
      winnerId: "a",
      isDraw: false,
      removeCompletedFromPaired: true,
    })
    expect(out.ok).toBe(false)
    expect(out.reason).toBe("already_completed")
    expect(out.players[0].score).toBe(0)
  })

  it("applies draw points to both players", () => {
    const p1 = makePlayer("a")
    const p2 = makePlayer("b")
    const out = applyMatchResultToState({
      pairedMatches: [makeMatch("m1", p1, p2)],
      allTimeMatches: [],
      players: [p1, p2],
      settings: { ...DEFAULT_SETTINGS, streakEnabled: false },
      matchId: "m1",
      winnerId: undefined,
      isDraw: true,
      removeCompletedFromPaired: true,
    })
    expect(out.ok).toBe(true)
    expect(out.players.find((p) => p.id === "a")?.score).toBe(DEFAULT_SETTINGS.drawPoints)
    expect(out.players.find((p) => p.id === "b")?.score).toBe(DEFAULT_SETTINGS.drawPoints)
    expect(out.players.find((p) => p.id === "a")?.gameResults).toEqual(["D"])
  })

  it("uses Swiss scoring and clears streak", () => {
    const p1 = makePlayer("a", { streak: 4 })
    const p2 = makePlayer("b")
    const out = applyMatchResultToState({
      pairedMatches: [makeMatch("m1", p1, p2)],
      allTimeMatches: [],
      players: [p1, p2],
      settings: {
        ...DEFAULT_SETTINGS,
        pairingAlgorithm: "swiss",
        swissWinPoints: 1,
        swissDrawPoints: 0.5,
        swissLossPoints: 0,
      },
      matchId: "m1",
      winnerId: "a",
      isDraw: false,
      removeCompletedFromPaired: false,
    })
    expect(out.ok).toBe(true)
    expect(out.players.find((p) => p.id === "a")?.score).toBe(1)
    expect(out.players.find((p) => p.id === "a")?.streak).toBe(0)
    expect(out.pairedMatches[0]?.result?.completed).toBe(true)
  })

  it("returns not_found for unknown match ids", () => {
    const out = applyMatchResultToState({
      pairedMatches: [],
      allTimeMatches: [],
      players: [],
      settings: DEFAULT_SETTINGS,
      matchId: "missing",
      winnerId: "a",
      isDraw: false,
      removeCompletedFromPaired: true,
    })
    expect(out.ok).toBe(false)
    expect(out.reason).toBe("not_found")
  })

  it("rejects pairing-bye matches", () => {
    const p1 = makePlayer("a")
    const bye = makePlayer(PAIRING_BYE_PLAYER_ID, { name: "Bye" })
    const out = applyMatchResultToState({
      pairedMatches: [makeMatch("bye1", p1, bye, { matchKind: "pairing-bye" })],
      allTimeMatches: [],
      players: [p1],
      settings: DEFAULT_SETTINGS,
      matchId: "bye1",
      winnerId: "a",
      isDraw: false,
      removeCompletedFromPaired: true,
    })
    expect(out.ok).toBe(false)
    expect(out.reason).toBe("pairing_bye")
  })

  it("applies arena streak multiplier when enabled", () => {
    const p1 = makePlayer("a", { streak: 2 })
    const p2 = makePlayer("b")
    const out = applyMatchResultToState({
      pairedMatches: [makeMatch("m1", p1, p2)],
      allTimeMatches: [],
      players: [p1, p2],
      settings: {
        ...DEFAULT_SETTINGS,
        streakEnabled: true,
        streakMultiplier: 2,
        winPoints: 2,
      },
      matchId: "m1",
      winnerId: "a",
      isDraw: false,
      removeCompletedFromPaired: true,
    })
    expect(out.ok).toBe(true)
    expect(out.players.find((p) => p.id === "a")?.score).toBe(4)
    expect(out.players.find((p) => p.id === "a")?.streak).toBe(3)
  })
})

describe("mergeMatchesForSave", () => {
  it("prefers allTime (completed) over paired for same id", () => {
    const p1 = makePlayer("a")
    const p2 = makePlayer("b")
    const open = makeMatch("m1", p1, p2)
    const done: Match = {
      ...open,
      result: { isDraw: true, completed: true, completedAt: 2 },
    }
    const merged = mergeMatchesForSave([open], [done])
    expect(merged).toHaveLength(1)
    expect(merged[0].result?.completed).toBe(true)
  })
})

describe("assignTablesToMatchesForState", () => {
  it("skips occupied tables and prefers higher combined score", () => {
    const low1 = makePlayer("l1", { score: 0 })
    const low2 = makePlayer("l2", { score: 0 })
    const high1 = makePlayer("h1", { score: 3 })
    const high2 = makePlayer("h2", { score: 2 })
    const occupying = makeMatch("busy", makePlayer("x"), makePlayer("y"), { tableNumber: 1 })
    const state = {
      players: [],
      rounds: [],
      currentRound: null,
      pairedMatches: [occupying],
      tournamentStartTime: null,
      tournamentDuration: 0,
      isActive: true,
      allTimeMatches: [],
      tableCount: 3,
      settings: { ...DEFAULT_SETTINGS, tableCount: 3 },
      status: "active" as const,
    } satisfies ArenaState

    const assigned = assignTablesToMatchesForState(
      [makeMatch("low", low1, low2), makeMatch("high", high1, high2)],
      state,
    )
    expect(assigned.find((m) => m.id === "high")?.tableNumber).toBe(2)
    expect(assigned.find((m) => m.id === "low")?.tableNumber).toBe(3)
  })
})
