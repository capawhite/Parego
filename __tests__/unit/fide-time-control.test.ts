import { describe, it, expect } from "vitest"
import {
  classifyFideTimeControl,
  effectiveFideMinutes,
  resolvePairingRating,
} from "@/lib/fide/time-control"

describe("fide time control", () => {
  describe("effectiveFideMinutes", () => {
    it("adds increment seconds as minutes over 60 moves", () => {
      expect(effectiveFideMinutes(5, 3)).toBe(8)
      expect(effectiveFideMinutes(90, 30)).toBe(120)
    })
  })

  describe("classifyFideTimeControl", () => {
    it("classifies blitz, rapid, and standard per FIDE rating regulations", () => {
      expect(classifyFideTimeControl(5, 3)).toBe("blitz")
      expect(classifyFideTimeControl(10, 0)).toBe("blitz")
      expect(classifyFideTimeControl(10, 1)).toBe("rapid")
      expect(classifyFideTimeControl(15, 10)).toBe("rapid")
      expect(classifyFideTimeControl(59, 0)).toBe("rapid")
      expect(classifyFideTimeControl(60, 0)).toBe("standard")
      expect(classifyFideTimeControl(90, 30)).toBe("standard")
    })

    it("returns unknown when time control is missing", () => {
      expect(classifyFideTimeControl(undefined, undefined)).toBe("unknown")
    })
  })

  describe("resolvePairingRating", () => {
    const fide = { standard: 2400, rapid: 2380, blitz: 2500 }

    it("uses manual override when provided", () => {
      expect(
        resolvePairingRating({
          manualRating: 1500,
          fideRatings: fide,
          baseTimeMinutes: 5,
          incrementSeconds: 3,
        }),
      ).toBe(1500)
    })

    it("picks blitz FIDE rating for blitz tournaments", () => {
      expect(
        resolvePairingRating({
          fideRatings: fide,
          profileRating: 2400,
          baseTimeMinutes: 5,
          incrementSeconds: 3,
        }),
      ).toBe(2500)
    })

    it("picks rapid FIDE rating for rapid tournaments", () => {
      expect(
        resolvePairingRating({
          fideRatings: fide,
          profileRating: 2400,
          baseTimeMinutes: 15,
          incrementSeconds: 10,
        }),
      ).toBe(2380)
    })

    it("picks standard FIDE rating for classical tournaments", () => {
      expect(
        resolvePairingRating({
          fideRatings: fide,
          baseTimeMinutes: 90,
          incrementSeconds: 30,
        }),
      ).toBe(2400)
    })

    it("does not use profile standard rating for blitz when blitz FIDE rating is missing", () => {
      expect(
        resolvePairingRating({
          fideRatings: { standard: 2000, rapid: null, blitz: null },
          profileRating: 2000,
          ratingBand: "intermediate",
          baseTimeMinutes: 5,
          incrementSeconds: 0,
        }),
      ).toBe(1500)
    })
  })
})
