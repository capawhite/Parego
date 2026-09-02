import { describe, it, expect } from "vitest"
import {
  extractFideRatings,
  fideRatingToBand,
  fideSelectionToDbFields,
  formatFideDisplayName,
  formatFideRatingsSummary,
  mergeDisplayRatings,
  missingFideRatingFields,
  parseRatingInput,
  pickFideRating,
  ratingsFromInputs,
} from "@/lib/fide/rating"

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

  describe("extractFideRatings", () => {
    it("keeps only positive ratings", () => {
      expect(extractFideRatings({ standard: 2400, rapid: 0, blitz: 2100 })).toEqual({
        standard: 2400,
        rapid: null,
        blitz: 2100,
      })
    })
  })

  describe("formatFideRatingsSummary", () => {
    it("lists available time controls", () => {
      const summary = formatFideRatingsSummary(
        { standard: 2823, rapid: 2803, blitz: null },
        { standard: "Std", rapid: "Rapid", blitz: "Blitz" },
      )
      expect(summary).toBe("Std 2823 • Rapid 2803")
    })
  })

  describe("fideSelectionToDbFields", () => {
    it("clears all fide columns when unlinked", () => {
      expect(fideSelectionToDbFields(null)).toEqual({
        fide_id: null,
        fide_title: null,
        fide_standard: null,
        fide_rapid: null,
        fide_blitz: null,
      })
    })
  })

  describe("missingFideRatingFields", () => {
    it("lists only null ratings from a FIDE profile", () => {
      expect(missingFideRatingFields({ standard: null, rapid: 2100, blitz: 2050 })).toEqual(["standard"])
    })
  })

  describe("mergeDisplayRatings", () => {
    it("fills classical from manual when FIDE has no standard", () => {
      expect(
        mergeDisplayRatings(
          { standard: null, rapid: 2300, blitz: 2250 },
          { standard: 1800, rapid: null, blitz: null },
        ),
      ).toEqual({ standard: 1800, rapid: 2300, blitz: 2250 })
    })
  })

  describe("parseRatingInput", () => {
    it("accepts valid ratings and rejects invalid", () => {
      expect(parseRatingInput("1847")).toBe(1847)
      expect(parseRatingInput("")).toBeNull()
      expect(parseRatingInput("99")).toBeNull()
      expect(parseRatingInput("3001")).toBeNull()
    })
  })

  describe("ratingsFromInputs", () => {
    it("parses each time control independently", () => {
      expect(ratingsFromInputs("1800", "", "1650")).toEqual({
        standard: 1800,
        rapid: null,
        blitz: 1650,
      })
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
