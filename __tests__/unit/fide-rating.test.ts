import { describe, it, expect } from "vitest"
import { fideRatingToBand, formatFideDisplayName, pickFideRating } from "@/lib/fide/rating"

describe("fide rating helpers", () => {
  describe("pickFideRating", () => {
    it("prefers standard over rapid and blitz", () => {
      expect(pickFideRating({ standard: 2400, rapid: 2380, blitz: 2500 })).toBe(2400)
    })

    it("falls back to rapid then blitz", () => {
      expect(pickFideRating({ standard: null, rapid: 2100, blitz: 2050 })).toBe(2100)
      expect(pickFideRating({ standard: null, rapid: null, blitz: 1900 })).toBe(1900)
    })

    it("returns null when no ratings", () => {
      expect(pickFideRating({ standard: null, rapid: null, blitz: null })).toBeNull()
    })
  })

  describe("fideRatingToBand", () => {
    it("maps ratings to simple bands", () => {
      expect(fideRatingToBand(1200)).toBe("beginner")
      expect(fideRatingToBand(1500)).toBe("intermediate")
      expect(fideRatingToBand(2200)).toBe("advanced")
    })
  })

  describe("formatFideDisplayName", () => {
    it("reorders comma-separated FIDE names", () => {
      expect(formatFideDisplayName("Carlsen, Magnus")).toBe("Magnus Carlsen")
    })

    it("returns name unchanged when no comma", () => {
      expect(formatFideDisplayName("Magnus Carlsen")).toBe("Magnus Carlsen")
    })
  })
})
