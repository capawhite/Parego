import { describe, it, expect } from "vitest"
import { calculatePointsFromSettings } from "@/lib/points"
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
})
