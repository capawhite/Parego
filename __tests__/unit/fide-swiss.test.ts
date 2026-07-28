import { describe, it, expect } from "vitest"
import {
  createSwissPairingsForRound,
  isPairingByeMatch,
  maybeAdvanceSwissLastCompletedRound,
  mergeMatchesForSwiss,
  nextSwissRoundToPair,
} from "@/lib/pairing/fide-swiss"
import { DEFAULT_SETTINGS, type Match, type Player, type TournamentSettings } from "@/lib/types"

function p(id: string, name: string, score = 0): Player {
  return {
    id,
    name,
    score,
    gamesPlayed: 0,
    streak: 0,
    performance: 0,
    active: true,
    paused: false,
    joinedAt: 0,
    opponentIds: [],
    gameResults: [],
    pieceColors: [],
  }
}

describe("fide-swiss", () => {
  const base: TournamentSettings = {
    ...DEFAULT_SETTINGS,
    pairingAlgorithm: "fide-swiss",
    plannedSwissRounds: 3,
    swissLastCompletedRound: 0,
  }

  it("shouldPair is unused; nextSwissRoundToPair is 1 when no matches", () => {
    expect(nextSwissRoundToPair(base, [])).toBe(1)
  })

  it("createSwissPairingsForRound pairs two players", () => {
    const players = [p("a", "A"), p("b", "B")]
    const matches = createSwissPairingsForRound(players, [], base, 4)
    expect(matches.length).toBe(1)
    expect(matches[0].matchKind).toBe("play")
    expect(matches[0].swissRound).toBe(1)
  })

  it("odd field yields one bye match with completed result", () => {
    const players = [p("a", "A"), p("b", "B"), p("c", "C")]
    const matches = createSwissPairingsForRound(players, [], base, 4)
    const bye = matches.find(isPairingByeMatch)
    expect(bye).toBeDefined()
    expect(bye!.result?.completed).toBe(true)
  })

  it("maybeAdvanceSwissLastCompletedRound when round all complete", () => {
    const m1: Match = {
      id: "m1",
      player1: p("a", "A"),
      player2: p("b", "B"),
      swissRound: 1,
      matchKind: "play",
      result: { isDraw: false, completed: true, completedAt: 1, winnerId: "a" },
    }
    const merged = mergeMatchesForSwiss([], [m1])
    const next = maybeAdvanceSwissLastCompletedRound(base, merged)
    expect(next.swissLastCompletedRound).toBe(1)
  })
})
