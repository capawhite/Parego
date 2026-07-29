import { describe, it, expect } from "vitest"
import {
  bestOrientationForPair,
  wouldAssignThirdConsecutiveSameColor,
} from "@/lib/pairing/color-consecutive-cap"
import type { Player } from "@/lib/types"

function makePlayer(id: string, pieceColors: ("white" | "black")[] = []): Player {
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

describe("wouldAssignThirdConsecutiveSameColor", () => {
  it("is false with empty or short history", () => {
    expect(wouldAssignThirdConsecutiveSameColor([], "white")).toBe(false)
    expect(wouldAssignThirdConsecutiveSameColor(["white"], "white")).toBe(false)
  })

  it("is true when assigning would make a third same color in a row", () => {
    expect(wouldAssignThirdConsecutiveSameColor(["white", "white"], "white")).toBe(true)
    expect(wouldAssignThirdConsecutiveSameColor(["black", "black"], "black")).toBe(true)
    expect(wouldAssignThirdConsecutiveSameColor(["white", "white"], "black")).toBe(false)
  })
})

describe("bestOrientationForPair", () => {
  it("returns null under strict when both orientations violate the cap", () => {
    // Either player as white would be a third consecutive white.
    const a = makePlayer("a", ["white", "white"])
    const b = makePlayer("b", ["white", "white"])
    expect(bestOrientationForPair(a, b, "high", "strict", new Set())).toBeNull()
  })

  it("allows relaxed orientation when violators are longest-waiting", () => {
    const a = makePlayer("a", ["white", "white"])
    const b = makePlayer("b", ["black", "black"])
    const out = bestOrientationForPair(a, b, "high", "relaxed", new Set(["a", "b"]))
    expect(out).not.toBeNull()
  })

  it("prefers giving white to the player with lower color balance", () => {
    const needsWhite = makePlayer("needs", ["black", "black", "black"])
    const needsBlack = makePlayer("has", ["white", "white", "white"])
    const out = bestOrientationForPair(needsWhite, needsBlack, "high", "none", new Set())
    expect(out?.whitePlayer.id).toBe("needs")
  })
})
