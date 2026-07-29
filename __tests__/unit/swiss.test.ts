import { describe, it, expect } from "vitest"
import {
  applyPairingByeToPlayers,
  canPairNextSwissRound,
  clampPlannedSwissRounds,
  createSwissRoundPairings,
  isPairingByeMatch,
  isSwissAlgorithm,
  maxSwissRoundsForPlayerCount,
  maybeAdvanceSwissLastCompletedRound,
  nextSwissRoundToPair,
  validateSwissTournamentField,
} from "@/lib/pairing/swiss"
import { DEFAULT_SETTINGS, PAIRING_BYE_PLAYER_ID, type Match, type Player } from "@/lib/types"

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

const swissSettings = {
  ...DEFAULT_SETTINGS,
  pairingAlgorithm: "swiss",
  plannedSwissRounds: 5,
  swissLastCompletedRound: 0,
}

describe("Club Swiss field limits", () => {
  it("rejects rounds below 3 and above 11", () => {
    expect(clampPlannedSwissRounds(1)).toBe(3)
    expect(clampPlannedSwissRounds(2)).toBe(3)
    expect(clampPlannedSwissRounds(12)).toBe(11)
    expect(clampPlannedSwissRounds(5)).toBe(5)
  })

  it("caps rounds at players − 1", () => {
    expect(maxSwissRoundsForPlayerCount(3)).toBe(0)
    expect(maxSwissRoundsForPlayerCount(4)).toBe(3)
    expect(maxSwissRoundsForPlayerCount(8)).toBe(7)
    expect(clampPlannedSwissRounds(5, 4)).toBe(3)
    expect(clampPlannedSwissRounds(5, 8)).toBe(5)
  })

  it("validateSwissTournamentField requires 4+ players and rounds ≤ N−1", () => {
    expect(validateSwissTournamentField(swissSettings, 3).valid).toBe(false)
    expect(validateSwissTournamentField({ ...swissSettings, plannedSwissRounds: 5 }, 4).valid).toBe(false)
    expect(validateSwissTournamentField({ ...swissSettings, plannedSwissRounds: 3 }, 4).valid).toBe(true)
    expect(validateSwissTournamentField({ ...swissSettings, plannedSwissRounds: 5 }, 8).valid).toBe(true)
  })

  it("treats fide-swiss as Swiss and ignores non-Swiss algorithms", () => {
    expect(isSwissAlgorithm("fide-swiss")).toBe(true)
    expect(validateSwissTournamentField({ pairingAlgorithm: "all-vs-all", plannedSwissRounds: 1 })).toEqual({
      valid: true,
    })
    expect(validateSwissTournamentField({ pairingAlgorithm: "fide-swiss", plannedSwissRounds: 5 }, 8).valid).toBe(
      true,
    )
  })

  it("reports clear validation error strings", () => {
    const tooFewRounds = validateSwissTournamentField({ pairingAlgorithm: "swiss", plannedSwissRounds: 2 })
    expect(tooFewRounds.valid).toBe(false)
    if (!tooFewRounds.valid) {
      expect(tooFewRounds.errors).toContain("plannedSwissRounds must be 3–11")
    }

    const tooFewPlayers = validateSwissTournamentField(swissSettings, 3)
    expect(tooFewPlayers.valid).toBe(false)
    if (!tooFewPlayers.valid) {
      expect(tooFewPlayers.errors).toContain("Swiss needs at least 4 players")
    }
  })

  it("caps max rounds at 11 even for large fields", () => {
    expect(maxSwissRoundsForPlayerCount(20)).toBe(11)
    expect(clampPlannedSwissRounds(Number.NaN)).toBe(3)
  })
})

describe("Club Swiss round gate", () => {
  it("allows round 1 when no matches exist", () => {
    expect(nextSwissRoundToPair(swissSettings, [])).toBe(1)
    expect(canPairNextSwissRound(swissSettings, [])).toBe(true)
  })

  it("blocks when current round already has pairings", () => {
    const a = makePlayer("a")
    const b = makePlayer("b")
    const matches: Match[] = [
      {
        id: "m1",
        player1: a,
        player2: b,
        swissRound: 1,
        matchKind: "play",
        tableNumber: 1,
      },
    ]
    expect(nextSwissRoundToPair(swissSettings, matches)).toBeNull()
  })

  it("allows next round only after prior play matches complete", () => {
    const a = makePlayer("a")
    const b = makePlayer("b")
    const open: Match[] = [
      {
        id: "m1",
        player1: a,
        player2: b,
        swissRound: 1,
        matchKind: "play",
        tableNumber: 1,
      },
    ]
    expect(nextSwissRoundToPair({ ...swissSettings, swissLastCompletedRound: 0 }, open)).toBeNull()

    const done: Match[] = [
      {
        ...open[0]!,
        result: { winnerId: "a", isDraw: false, completed: true, completedAt: 1 },
      },
    ]
    expect(nextSwissRoundToPair({ ...swissSettings, swissLastCompletedRound: 1 }, done)).toBe(2)
  })

  it("blocks pairing once planned rounds are finished", () => {
    expect(
      nextSwissRoundToPair({ ...swissSettings, plannedSwissRounds: 3, swissLastCompletedRound: 3 }, []),
    ).toBeNull()
  })

  it("advances swissLastCompletedRound when all round matches finish", () => {
    const a = makePlayer("a")
    const b = makePlayer("b")
    const matches: Match[] = [
      {
        id: "m1",
        player1: a,
        player2: b,
        swissRound: 1,
        matchKind: "play",
        tableNumber: 1,
        result: { winnerId: "a", isDraw: false, completed: true, completedAt: 1 },
      },
    ]
    const advanced = maybeAdvanceSwissLastCompletedRound(swissSettings, matches)
    expect(advanced.swissLastCompletedRound).toBe(1)
  })

  it("treats pairing byes as completed for round advance", () => {
    const a = makePlayer("a")
    const b = makePlayer("b")
    const c = makePlayer("c")
    const byeOpp = makePlayer(PAIRING_BYE_PLAYER_ID, { name: "Bye" })
    const matches: Match[] = [
      {
        id: "m1",
        player1: a,
        player2: b,
        swissRound: 1,
        matchKind: "play",
        tableNumber: 1,
        result: { winnerId: "a", isDraw: false, completed: true, completedAt: 1 },
      },
      {
        id: "bye1",
        player1: c,
        player2: byeOpp,
        swissRound: 1,
        matchKind: "pairing-bye",
        tableNumber: 0,
        result: { winnerId: "c", isDraw: false, completed: true, completedAt: 1 },
      },
    ]
    expect(maybeAdvanceSwissLastCompletedRound(swissSettings, matches).swissLastCompletedRound).toBe(1)
  })
})

describe("createSwissRoundPairings", () => {
  it("pairs even field and assigns tables", () => {
    const players = [makePlayer("a"), makePlayer("b"), makePlayer("c"), makePlayer("d")]
    const out = createSwissRoundPairings(players, [], swissSettings, 4)
    expect(out.filter((m) => m.matchKind === "play")).toHaveLength(2)
    expect(out.every((m) => m.swissRound === 1)).toBe(true)
    expect(out.some(isPairingByeMatch)).toBe(false)
  })

  it("gives a pairing bye to odd field", () => {
    const players = [
      makePlayer("a"),
      makePlayer("b"),
      makePlayer("c"),
      makePlayer("d"),
      makePlayer("e"),
    ]
    const out = createSwissRoundPairings(players, [], swissSettings, 4)
    expect(out.filter((m) => m.matchKind === "play")).toHaveLength(2)
    const bye = out.find(isPairingByeMatch)
    expect(bye).toBeTruthy()
    expect(bye!.player2.id).toBe(PAIRING_BYE_PLAYER_ID)
    expect(bye!.result?.completed).toBe(true)

    const withBye = applyPairingByeToPlayers(bye!, players, swissSettings)
    const recipient = withBye.find((p) => p.id === bye!.player1.id)!
    expect(recipient.receivedPairingBye).toBe(true)
    expect(recipient.score).toBe(1)
  })

  it("returns empty when fewer than 4 players", () => {
    const players = [makePlayer("a"), makePlayer("b"), makePlayer("c")]
    expect(createSwissRoundPairings(players, [], swissSettings, 4)).toEqual([])
  })

  it("returns empty when rematch cannot be avoided", () => {
    const a = makePlayer("a", { score: 1 })
    const b = makePlayer("b", { score: 1 })
    const history: Match[] = [
      {
        id: "prev",
        player1: a,
        player2: b,
        swissRound: 1,
        matchKind: "play",
        tableNumber: 1,
        result: { winnerId: "a", isDraw: false, completed: true, completedAt: 1 },
      },
    ]
    const out = createSwissRoundPairings(
      [a, b],
      history,
      { ...swissSettings, swissLastCompletedRound: 1, plannedSwissRounds: 3 },
      4,
    )
    expect(out).toEqual([])
  })

  it("returns empty when not enough tables", () => {
    const players = [makePlayer("a"), makePlayer("b"), makePlayer("c"), makePlayer("d")]
    expect(createSwissRoundPairings(players, [], swissSettings, 1)).toEqual([])
  })
})
