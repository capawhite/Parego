import { describe, expect, it } from "vitest"
import { collectPairingInputs } from "@/lib/tournament/collect-pairing-inputs"
import { DEFAULT_SETTINGS, type ArenaState, type Player } from "@/lib/types"

function p(id: string): Player {
  return {
    id,
    name: id,
    score: 0,
    gamesPlayed: 0,
    streak: 0,
    performance: 0,
    opponentIds: [],
    gameResults: [],
    pieceColors: [],
    active: true,
    paused: false,
    joinedAt: 0,
    checkedInAt: Date.now(),
  }
}

describe("collectPairingInputs", () => {
  it("counts free tables and available players", () => {
    const state: ArenaState = {
      players: [p("a"), p("b"), p("c"), p("d")],
      rounds: [],
      currentRound: null,
      pairedMatches: [
        {
          id: "m1",
          player1: p("a"),
          player2: p("b"),
          tableNumber: 1,
        },
      ],
      tournamentStartTime: null,
      tournamentDuration: 0,
      isActive: true,
      allTimeMatches: [],
      tableCount: 3,
      settings: { ...DEFAULT_SETTINGS, tableCount: 3 },
      status: "active",
    }
    const out = collectPairingInputs(state, false)
    expect(out.availableTables).toBe(2)
    expect(out.availablePlayers.map((x) => x.id).sort()).toEqual(["c", "d"])
    expect(out.activePairingMatches).toHaveLength(1)
  })
})
