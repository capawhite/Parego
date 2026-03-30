import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { balancedStrengthAlgorithm } from "@/lib/pairing/balanced-strength"
import { idleWaitStartMsForFairPairing } from "@/lib/pairing/idle-wait"
import { DEFAULT_SETTINGS, type Match, type Player, type TournamentSettings } from "@/lib/types"

const FIXED_NOW = 2_000_000

function basePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p1",
    name: "A",
    score: 0,
    gamesPlayed: 0,
    streak: 0,
    performance: 0,
    active: true,
    paused: false,
    joinedAt: 100,
    opponentIds: [],
    gameResults: [],
    pieceColors: [],
    ...overrides,
  }
}

function completedMatch(p1: Player, p2: Player, endTime: number, startTime: number): Match {
  return {
    id: `m-${p1.id}-${p2.id}`,
    player1: p1,
    player2: p2,
    startTime,
    endTime,
    result: { isDraw: false, completed: true, completedAt: endTime },
  }
}

describe("balanced-strength idle fairness", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("pairs the longest-idle player when odd count forces a sit-out", () => {
    const longIdle = basePlayer({
      id: "longest-idle",
      name: "Long",
      joinedAt: 0,
      gameResults: [],
    })

    const recent = ["r2", "r3", "r4", "r5"].map((id, i) =>
      basePlayer({
        id,
        name: id,
        joinedAt: 100 + i,
        gameResults: ["W"],
        opponentIds: ["x"],
      }),
    )

    const history: Match[] = []
    const endPrev = 1_000_000
    for (const p of recent) {
      const opp = basePlayer({ id: `opp-${p.id}` })
      history.push(completedMatch(p, opp, endPrev, endPrev - 60_000))
    }

    const available = [longIdle, ...recent]
    const settings: TournamentSettings = {
      ...DEFAULT_SETTINGS,
      pairingAlgorithm: "balanced-strength",
      tableCount: 2,
      baseTimeMinutes: 5,
      incrementSeconds: 0,
    }

    const matches = balancedStrengthAlgorithm.createPairings(
      available,
      history,
      settings,
      2,
      5,
    )

    expect(matches.length).toBe(2)

    const pairedIds = new Set<string>()
    for (const m of matches) {
      pairedIds.add(m.player1.id)
      pairedIds.add(m.player2.id)
    }

    expect(pairedIds.has("longest-idle")).toBe(true)
  })

  it("leaves a minimum-idle player unmatched when one must sit", () => {
    const longIdle = basePlayer({
      id: "longest-idle",
      name: "Long",
      joinedAt: 0,
      gameResults: [],
    })

    const shortestIdle = basePlayer({
      id: "shortest-idle",
      name: "Short",
      joinedAt: 500_000,
      gameResults: ["W"],
      opponentIds: ["x"],
    })

    const mid = ["m1", "m2", "m3"].map((id, i) =>
      basePlayer({
        id,
        name: id,
        joinedAt: 200 + i,
        gameResults: ["W"],
        opponentIds: ["x"],
      }),
    )

    const history: Match[] = []
    const endLong = 500_000
    history.push(completedMatch(shortestIdle, basePlayer({ id: "o-short" }), endLong, endLong - 10_000))
    const endMid = 800_000
    for (const p of mid) {
      history.push(completedMatch(p, basePlayer({ id: `o-${p.id}` }), endMid, endMid - 10_000))
    }

    const available = [longIdle, shortestIdle, ...mid]
    const settings: TournamentSettings = {
      ...DEFAULT_SETTINGS,
      pairingAlgorithm: "balanced-strength",
      tableCount: 2,
      baseTimeMinutes: 5,
      incrementSeconds: 0,
    }

    const matches = balancedStrengthAlgorithm.createPairings(
      available,
      history,
      settings,
      2,
      5,
    )

    expect(matches.length).toBe(2)
    const pairedIds = new Set<string>()
    for (const m of matches) {
      pairedIds.add(m.player1.id)
      pairedIds.add(m.player2.id)
    }

    const unpaired = available.filter((p) => !pairedIds.has(p.id))
    expect(unpaired).toHaveLength(1)
    const poolMin = Math.min(...available.map((pl) => pl.joinedAt))
    const idleMs = (pl: Player) =>
      Math.max(0, FIXED_NOW - idleWaitStartMsForFairPairing(pl, history, poolMin))
    const minIdle = Math.min(...available.map((pl) => idleMs(pl)))
    expect(idleMs(unpaired[0])).toBe(minIdle)
  })

  it("pairs a never-played late joiner when they would lose on raw joinedAt alone", () => {
    const early = ["e1", "e2", "e3", "e4"].map((id, i) =>
      basePlayer({
        id,
        name: id,
        joinedAt: i * 10,
        gameResults: ["W"],
        opponentIds: ["x"],
      }),
    )

    const lateNeverPlayed = basePlayer({
      id: "guest-whale",
      name: "Guest_Whale",
      joinedAt: 900_000,
      gameResults: [],
    })

    const history: Match[] = []
    const endGames = 850_000
    for (const p of early) {
      history.push(completedMatch(p, basePlayer({ id: `opp-${p.id}` }), endGames, endGames - 60_000))
    }

    const available = [...early, lateNeverPlayed]
    const settings: TournamentSettings = {
      ...DEFAULT_SETTINGS,
      pairingAlgorithm: "balanced-strength",
      tableCount: 2,
      baseTimeMinutes: 5,
      incrementSeconds: 0,
    }

    const matches = balancedStrengthAlgorithm.createPairings(
      available,
      history,
      settings,
      2,
      5,
    )

    const pairedIds = new Set<string>()
    for (const m of matches) {
      pairedIds.add(m.player1.id)
      pairedIds.add(m.player2.id)
    }
    expect(pairedIds.has("guest-whale")).toBe(true)
  })

  it("fills up to maxMatches with full table range fallback when needed", () => {
    const players = Array.from({ length: 7 }, (_, i) =>
      basePlayer({
        id: `p${i}`,
        name: `P${i}`,
        joinedAt: i * 1000,
        gameResults: i > 0 ? ["W"] : [],
        opponentIds: i > 0 ? ["x"] : [],
      }),
    )
    const history: Match[] = []
    const endT = 1_500_000
    for (let i = 1; i < 7; i++) {
      history.push(
        completedMatch(players[i], basePlayer({ id: `opp-${i}` }), endT, endT - 50_000),
      )
    }

    const settings: TournamentSettings = {
      ...DEFAULT_SETTINGS,
      pairingAlgorithm: "balanced-strength",
      tableCount: 3,
      baseTimeMinutes: 5,
      incrementSeconds: 0,
    }

    const matches = balancedStrengthAlgorithm.createPairings(
      players,
      history,
      settings,
      3,
      7,
    )

    expect(matches.length).toBe(3)
  })
})
