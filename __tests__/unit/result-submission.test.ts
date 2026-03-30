import { describe, it, expect } from "vitest"
import {
  parsePlayerData,
  getSubmissionSide,
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
})
