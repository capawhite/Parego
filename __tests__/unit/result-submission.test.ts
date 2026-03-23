import { describe, it, expect } from "vitest"
import {
  parsePlayerData,
  getPlayerUserId,
  getSubmissionSide,
  submissionsAgree,
  agreedResultToWinner,
  hasSubmissionConflict,
} from "@/lib/result-utils"

describe("result-submission (players submitting from own devices)", () => {
  describe("parsePlayerData", () => {
    it("parses JSON string with userId (camelCase)", () => {
      const data = JSON.stringify({ userId: "user-1" })
      expect(parsePlayerData(data)).toEqual({ userId: "user-1" })
    })

    it("parses JSON string with user_id (snake_case)", () => {
      const data = JSON.stringify({ user_id: "user-2" })
      expect(parsePlayerData(data)).toEqual({ user_id: "user-2" })
    })

    it("returns object as-is when already object", () => {
      expect(parsePlayerData({ userId: "u1" })).toEqual({ userId: "u1" })
      expect(parsePlayerData({ user_id: "u2" })).toEqual({ user_id: "u2" })
    })

    it("returns null for null/undefined/invalid", () => {
      expect(parsePlayerData(null)).toBeNull()
      expect(parsePlayerData(undefined)).toBeNull()
      expect(parsePlayerData("")).toBeNull()
      expect(parsePlayerData("not json")).toBeNull()
    })
  })

  describe("getPlayerUserId", () => {
    it("prefers userId then user_id", () => {
      expect(getPlayerUserId({ userId: "a", user_id: "b" })).toBe("a")
      expect(getPlayerUserId({ user_id: "b" })).toBe("b")
      expect(getPlayerUserId(null)).toBeNull()
      expect(getPlayerUserId({})).toBeNull()
    })
  })

  describe("getSubmissionSide", () => {
    it("returns player1 when user is in player1 data", () => {
      expect(
        getSubmissionSide("user-1", { userId: "user-1" }, { userId: "user-2" }),
      ).toBe("player1")
    })

    it("returns player2 when user is in player2 data", () => {
      expect(
        getSubmissionSide("user-2", { userId: "user-1" }, { userId: "user-2" }),
      ).toBe("player2")
    })

    it("returns null when user is not in match", () => {
      expect(
        getSubmissionSide("user-3", { userId: "user-1" }, { userId: "user-2" }),
      ).toBeNull()
    })

    it("works with snake_case user_id", () => {
      expect(
        getSubmissionSide("user-2", { user_id: "user-1" }, { user_id: "user-2" }),
      ).toBe("player2")
    })
  })

  describe("submissionsAgree", () => {
    it("returns true when both same result", () => {
      expect(submissionsAgree("player1-win", "player1-win")).toBe(true)
      expect(submissionsAgree("draw", "draw")).toBe(true)
      expect(submissionsAgree("player2-win", "player2-win")).toBe(true)
    })

    it("returns false when different or missing", () => {
      expect(submissionsAgree("player1-win", "player2-win")).toBe(false)
      expect(submissionsAgree("draw", "player1-win")).toBe(false)
      expect(submissionsAgree("player1-win", null)).toBe(false)
      expect(submissionsAgree(undefined, "draw")).toBe(false)
    })
  })

  describe("agreedResultToWinner (communicating result → leaderboard update)", () => {
    const p1Id = "player-1"
    const p2Id = "player-2"

    it("draw → no winner", () => {
      expect(agreedResultToWinner("draw", p1Id, p2Id)).toEqual({ winnerId: undefined, isDraw: true })
    })

    it("player1-win → winner is player1", () => {
      expect(agreedResultToWinner("player1-win", p1Id, p2Id)).toEqual({ winnerId: p1Id, isDraw: false })
    })

    it("player2-win → winner is player2", () => {
      expect(agreedResultToWinner("player2-win", p1Id, p2Id)).toEqual({ winnerId: p2Id, isDraw: false })
    })
  })

  describe("hasSubmissionConflict", () => {
    it("true when both confirmed and different results", () => {
      expect(
        hasSubmissionConflict("player1-win", true, "player2-win", true),
      ).toBe(true)
    })

    it("false when both confirmed and same result", () => {
      expect(
        hasSubmissionConflict("player1-win", true, "player1-win", true),
      ).toBe(false)
    })

    it("false when only one confirmed", () => {
      expect(
        hasSubmissionConflict("player1-win", true, "player2-win", false),
      ).toBe(false)
    })
  })
})
