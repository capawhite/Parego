import { describe, it, expect } from "vitest"
import { calculatePointsFromSettings, calculatePointChange } from "@/lib/points"
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

  describe("calculatePointChange", () => {
    it("W=2, D=1, L=0 without streak", () => {
      expect(calculatePointChange("W", 0)).toBe(2)
      expect(calculatePointChange("D", 0)).toBe(1)
      expect(calculatePointChange("L", 0)).toBe(0)
    })

    it("streak >= 2 doubles (W=4, D=2)", () => {
      expect(calculatePointChange("W", 2)).toBe(4)
      expect(calculatePointChange("D", 2)).toBe(2)
      expect(calculatePointChange("L", 2)).toBe(0)
    })
  })
})
