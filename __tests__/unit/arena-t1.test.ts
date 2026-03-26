import { describe, expect, it } from "vitest"
import {
  arenaPairingEligibleAtMs,
  filterArenaT1EligiblePlayers,
  isArenaT1Eligible,
  matchEffectiveEndMs,
  t1CapMsFromTp,
  t1MsFromLastGame,
  tpMsFromSettings,
} from "@/lib/pairing/arena-t1"
import { DEFAULT_SETTINGS, type Match, type Player, type TournamentSettings } from "@/lib/types"

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
    joinedAt: 1_000_000,
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

describe("arena-t1", () => {
  it("tpMsFromSettings matches balanced-strength defaults", () => {
    const s: TournamentSettings = { ...DEFAULT_SETTINGS, baseTimeMinutes: 5, incrementSeconds: 0 }
    expect(tpMsFromSettings(s)).toBe(5 * 60 * 1000 * 2)
  })

  it("t1CapMsFromTp uses balanced hybrid cap", () => {
    expect(t1CapMsFromTp(240_000)).toBe(90_000) // 2+0 => floor at 90s
    expect(t1CapMsFromTp(600_000)).toBe(90_000) // 5+0 => still 90s
    expect(t1CapMsFromTp(3_600_000)).toBe(180_000) // 30+0 => ceiling at 180s
    expect(t1CapMsFromTp(10_800_000)).toBe(180_000) // 90+0 => ceiling at 180s
    expect(t1CapMsFromTp(600_000, "fast")).toBe(60_000)
    expect(t1CapMsFromTp(600_000, "strict")).toBe(150_000)
  })

  it("t1MsFromLastGame caps at balanced cap (not full Tp)", () => {
    const tp = 600_000
    expect(t1MsFromLastGame("W", 1, tp)).toBe(90_000)
  })

  it("matchEffectiveEndMs prefers endTime then completedAt", () => {
    const p1 = basePlayer({ id: "a" })
    const p2 = basePlayer({ id: "b" })
    const m = completedMatch(p1, p2, 5000, 1000)
    expect(matchEffectiveEndMs(m)).toBe(5000)
  })

  it("never-played player is eligible from joinedAt", () => {
    const p = basePlayer({ id: "x", joinedAt: 10_000 })
    const settings: TournamentSettings = { ...DEFAULT_SETTINGS, baseTimeMinutes: 5 }
    expect(arenaPairingEligibleAtMs(p, [], settings)).toBe(10_000)
    expect(isArenaT1Eligible(p, [], settings, 10_000)).toBe(true)
    expect(isArenaT1Eligible(p, [], settings, 9999)).toBe(false)
  })

  it("after a game, eligible only after end + T1", () => {
    const p1 = basePlayer({ id: "a", joinedAt: 0, gameResults: ["W"] })
    const p2 = basePlayer({ id: "b" })
    const end = 1_000_000
    const start = end - 60_000
    const m = completedMatch(p1, p2, end, start)
    const settings: TournamentSettings = { ...DEFAULT_SETTINGS, baseTimeMinutes: 5, incrementSeconds: 0 }
    const tp = tpMsFromSettings(settings)
    const dp = end - start
    const t1 = t1MsFromLastGame("W", dp, tp)
    const eligibleAt = arenaPairingEligibleAtMs(p1, [m], settings)
    expect(eligibleAt).toBe(end + t1)
    expect(isArenaT1Eligible(p1, [m], settings, end + t1 - 1)).toBe(false)
    expect(isArenaT1Eligible(p1, [m], settings, end + t1)).toBe(true)
  })

  it("when no usable end/start on completed match, eligible at 0 (avoid deadlock)", () => {
    const p1 = basePlayer({ id: "a", gameResults: ["W"] })
    const p2 = basePlayer({ id: "b" })
    const m = {
      id: "m",
      player1: p1,
      player2: p2,
      result: { isDraw: false, completed: true },
    } as unknown as Match
    const settings: TournamentSettings = { ...DEFAULT_SETTINGS, baseTimeMinutes: 5 }
    expect(arenaPairingEligibleAtMs(p1, [m], settings)).toBe(0)
    expect(isArenaT1Eligible(p1, [m], settings, 1)).toBe(true)
  })

  it("filterArenaT1EligiblePlayers drops players still in T1", () => {
    const p1 = basePlayer({ id: "a", gameResults: ["W"] })
    const p2 = basePlayer({ id: "b", gameResults: ["L"] })
    const end = 1_000_000
    const m = completedMatch(p1, p2, end, end - 120_000)
    const settings: TournamentSettings = { ...DEFAULT_SETTINGS, baseTimeMinutes: 5, incrementSeconds: 0 }
    const t1 = t1MsFromLastGame("W", 120_000, tpMsFromSettings(settings))
    const during = filterArenaT1EligiblePlayers([p1, p2], [m], settings, end + Math.floor(t1 / 2))
    expect(during.length).toBe(0)
    const after = filterArenaT1EligiblePlayers([p1, p2], [m], settings, end + t1)
    expect(after.map((p) => p.id).sort()).toEqual(["a", "b"])
  })
})
