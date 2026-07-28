import { describe, it, expect } from "vitest"
import { applyMatchResultToState } from "@/lib/tournament/apply-match-result"
import { mergeMatchesForSave } from "@/lib/tournament/merge-matches"
import { DEFAULT_SETTINGS, type Match, type Player } from "@/lib/types"

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

function makeMatch(id: string, p1: Player, p2: Player): Match {
  return {
    id,
    player1: p1,
    player2: p2,
    tableNumber: 1,
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
