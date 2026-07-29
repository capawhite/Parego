import { describe, it, expect } from "vitest"
import { isPlayerAvailableForPairing } from "@/lib/pairing/player-eligibility"
import type { Match, Player } from "@/lib/types"

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
    ...overrides,
  }
}

function makeMatch(p1: Player, p2: Player): Match {
  return { id: "m1", player1: p1, player2: p2, tableNumber: 1 }
}

describe("isPlayerAvailableForPairing", () => {
  const a = makePlayer("a")
  const b = makePlayer("b")

  it("is available when idle and not paused", () => {
    expect(isPlayerAvailableForPairing(a, [], false)).toBe(true)
  })

  it("rejects paused, left, marked for removal/pause", () => {
    expect(isPlayerAvailableForPairing(makePlayer("a", { paused: true }), [], false)).toBe(false)
    expect(isPlayerAvailableForPairing(makePlayer("a", { hasLeft: true }), [], false)).toBe(false)
    expect(isPlayerAvailableForPairing(makePlayer("a", { markedForRemoval: true }), [], false)).toBe(false)
    expect(isPlayerAvailableForPairing(makePlayer("a", { markedForPause: true }), [], false)).toBe(false)
  })

  it("rejects players already in an active pairing", () => {
    expect(isPlayerAvailableForPairing(a, [makeMatch(a, b)], false)).toBe(false)
    expect(isPlayerAvailableForPairing(b, [makeMatch(a, b)], false)).toBe(false)
  })

  it("requires check-in when venue is set", () => {
    expect(isPlayerAvailableForPairing(makePlayer("a", { checkedInAt: undefined }), [], true)).toBe(false)
    expect(isPlayerAvailableForPairing(makePlayer("a", { checkedInAt: Date.now() }), [], true)).toBe(true)
  })
})
