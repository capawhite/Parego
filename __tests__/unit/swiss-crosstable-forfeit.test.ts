import { describe, it, expect } from "vitest"
import { applyMatchResultToState } from "@/lib/tournament/apply-match-result"
import { buildSwissCrosstable, groupCompletedMatchesByRound } from "@/lib/swiss-crosstable"
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

function makeMatch(id: string, p1: Player, p2: Player, overrides: Partial<Match> = {}): Match {
  return { id, player1: p1, player2: p2, tableNumber: 1, ...overrides }
}

describe("forfeit results", () => {
  it("marks winner with receivedForfeitWin and stores isForfeit on match", () => {
    const p1 = makePlayer("a")
    const p2 = makePlayer("b")
    const match = makeMatch("m1", p1, p2)
    const out = applyMatchResultToState({
      pairedMatches: [match],
      allTimeMatches: [],
      players: [p1, p2],
      settings: { ...DEFAULT_SETTINGS, pairingAlgorithm: "swiss", swissWinPoints: 1, swissDrawPoints: 0.5, swissLossPoints: 0 },
      matchId: "m1",
      winnerId: "a",
      isDraw: false,
      isForfeit: true,
      removeCompletedFromPaired: false,
    })
    expect(out.ok).toBe(true)
    expect(out.completedMatch?.result?.isForfeit).toBe(true)
    expect(out.players.find((p) => p.id === "a")?.receivedForfeitWin).toBe(true)
    expect(out.players.find((p) => p.id === "b")?.receivedForfeitWin).toBeFalsy()
    expect(out.players.find((p) => p.id === "a")?.score).toBe(1)
    expect(out.players.find((p) => p.id === "a")?.streak).toBe(0)
  })
})

describe("swiss crosstable", () => {
  it("builds player × round matrix", () => {
    const a = makePlayer("a", { score: 1 })
    const b = makePlayer("b", { score: 0 })
    const matches: Match[] = [
      {
        ...makeMatch("m1", a, b, { swissRound: 1 }),
        result: { winnerId: "a", isDraw: false, completed: true, completedAt: 1 },
      },
    ]
    const rows = buildSwissCrosstable([a, b], matches, 3)
    expect(rows).toHaveLength(2)
    expect(rows[0].player.id).toBe("a")
    expect(rows[0].cells[0].scoreText).toBe("1")
    expect(rows[0].cells[1].scoreText).toBe("—")
    expect(rows[1].cells[0].scoreText).toBe("0")
  })

  it("groups completed matches by round descending", () => {
    const a = makePlayer("a")
    const b = makePlayer("b")
    const groups = groupCompletedMatchesByRound([
      {
        ...makeMatch("m2", a, b, { swissRound: 2 }),
        result: { isDraw: true, completed: true, completedAt: 2 },
      },
      {
        ...makeMatch("m1", a, b, { swissRound: 1 }),
        result: { winnerId: "a", isDraw: false, completed: true, completedAt: 1 },
      },
    ])
    expect(groups.map((g) => g.round)).toEqual([2, 1])
  })
})
