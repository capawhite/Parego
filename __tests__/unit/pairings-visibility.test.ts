import { describe, it, expect } from "vitest"
import {
  getVisibleMatchesForPlayer,
  getMyPendingMatch,
  getOpponentInMatch,
} from "@/lib/pairings-utils"
import type { Match, Player } from "@/lib/types"

function p(overrides: Partial<Player> & { id: string; name: string }): Player {
  const { id, name, ...rest } = overrides
  return {
    id,
    name,
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
    ...rest,
  }
}

function match(id: string, p1: Player, p2: Player, completed = false): Match {
  return {
    id,
    player1: p1,
    player2: p2,
    result: completed ? { winnerId: p1.id, isDraw: false, completed: true, completedAt: Date.now() } : undefined,
  }
}

describe("pairings visibility (informing players what pairings are on, next opponent)", () => {
  const alice = p({ id: "alice", name: "Alice" })
  const bob = p({ id: "bob", name: "Bob" })
  const carol = p({ id: "carol", name: "Carol" })

  const matches: Match[] = [
    match("m1", alice, bob, false),
    match("m2", carol, p({ id: "dave", name: "Dave" }), false),
  ]

  describe("getVisibleMatchesForPlayer", () => {
    it("player sees only their own matches", () => {
      const visible = getVisibleMatchesForPlayer(matches, "alice", "player")
      expect(visible).toHaveLength(1)
      expect(visible[0].id).toBe("m1")
    })

    it("organizer sees all matches", () => {
      const visible = getVisibleMatchesForPlayer(matches, "alice", "organizer")
      expect(visible).toHaveLength(2)
    })

    it("no playerId returns all (e.g. not logged in)", () => {
      const visible = getVisibleMatchesForPlayer(matches, null, "player")
      expect(visible).toHaveLength(2)
    })
  })

  describe("getMyPendingMatch", () => {
    it("returns the pending match for the player", () => {
      const my = getMyPendingMatch(matches, "alice")
      expect(my).toBeDefined()
      expect(my!.id).toBe("m1")
    })

    it("returns match when player is in a pending match", () => {
      const my = getMyPendingMatch(matches, "dave")
      expect(my).toBeDefined()
      expect(my!.id).toBe("m2")
    })

    it("returns undefined when player has no pending match", () => {
      const my = getMyPendingMatch(matches, "eve")
      expect(my).toBeUndefined()
    })

    it("excludes completed matches", () => {
      const withCompleted = [
        ...matches,
        match("m3", alice, carol, true),
      ]
      const my = getMyPendingMatch(withCompleted, "alice")
      expect(my).toBeDefined()
      expect(my!.id).toBe("m1")
    })
  })

  describe("getOpponentInMatch", () => {
    it("returns opponent for player1", () => {
      expect(getOpponentInMatch(matches[0], "alice")).toEqual({ id: "bob", name: "Bob" })
    })

    it("returns opponent for player2", () => {
      expect(getOpponentInMatch(matches[0], "bob")).toEqual({ id: "alice", name: "Alice" })
    })

    it("returns null when player not in match", () => {
      expect(getOpponentInMatch(matches[0], "carol")).toBeNull()
    })
  })
})
