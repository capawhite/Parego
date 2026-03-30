import { describe, expect, it } from "vitest"
import {
  colorBalance,
  sameColorTailStreak,
  scoreMatchingMultiplier,
} from "@/lib/pairing/color-utils"
import type { Player } from "@/lib/types"

function makePlayer(id: string, pieceColors: ("white" | "black")[]): Player {
  return {
    id,
    name: id,
    score: 0,
    gamesPlayed: pieceColors.length,
    streak: 0,
    performance: 0,
    active: true,
    paused: false,
    joinedAt: 0,
    opponentIds: [],
    gameResults: [],
    pieceColors,
  }
}

describe("color-utils", () => {
  it("colorBalance counts whites minus blacks", () => {
    expect(colorBalance([])).toBe(0)
    expect(colorBalance(["white", "black"])).toBe(0)
    expect(colorBalance(["white", "white", "black"])).toBe(1)
  })

  it("sameColorTailStreak reads end run", () => {
    expect(sameColorTailStreak([])).toEqual({ color: null, length: 0 })
    expect(sameColorTailStreak(["black", "white", "white"])).toEqual({ color: "white", length: 2 })
    expect(sameColorTailStreak(["white", "white", "white"])).toEqual({ color: "white", length: 3 })
  })

  it("scoreMatchingMultiplier scales strictness", () => {
    expect(scoreMatchingMultiplier("loose")).toBe(1)
    expect(scoreMatchingMultiplier("normal")).toBe(2)
    expect(scoreMatchingMultiplier("strict")).toBe(4)
  })
})
