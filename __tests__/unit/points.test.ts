import { describe, it, expect } from "vitest"
import { calculatePointsFromSettings, pointsEarnedFromGameResults } from "@/lib/points"
import { DEFAULT_SETTINGS } from "@/lib/types"

describe("points (scoring when results are recorded)", () => {
  const settings = DEFAULT_SETTINGS

  describe("calculatePointsFromSettings", () => {
    it("draw gives drawPoints", () => {
      expect(calculatePointsFromSettings(false, true, 0, settings)).toBe(1)
    })

    it("win gives winPoints", () => {
      expect(calculatePointsFromSettings(true, false, 0, settings)).toBe(2)
    })

    it("loss gives lossPoints", () => {
      expect(calculatePointsFromSettings(false, false, 0, settings)).toBe(0)
    })

    it("streak >= 2 multiplies points", () => {
      expect(calculatePointsFromSettings(true, false, 2, settings)).toBe(4)
      expect(calculatePointsFromSettings(false, true, 2, settings)).toBe(2)
    })
  })

  describe("pointsEarnedFromGameResults", () => {
    it("replays streak and matches per-game calculatePointsFromSettings", () => {
      const games: ("W" | "D" | "L")[] = ["W", "W", "L", "W"]
      const earned = pointsEarnedFromGameResults(games, settings)
      expect(earned).toHaveLength(4)
      let streak = 0
      for (let i = 0; i < games.length; i++) {
        const r = games[i]
        const isD = r === "D"
        const isW = r === "W"
        expect(earned[i]).toBe(calculatePointsFromSettings(isW, isD, streak, settings))
        streak = isD ? 0 : isW ? streak + 1 : 0
      }
    })

    it("uses custom win/draw/loss from settings", () => {
      const custom = { ...settings, winPoints: 3, drawPoints: 2, lossPoints: 0.5 }
      expect(pointsEarnedFromGameResults(["W", "D", "L"], custom)).toEqual([3, 2, 0.5])
    })
  })
})
