/**
 * Rating band from onboarding (fun question). No precise number required.
 */
export const RATING_BANDS = [
  { value: "unrated", label: "I'm too weak to know" },
  { value: "around_1500", label: "I once heard I was about 1500" },
  { value: "around_2000", label: "I'm almost 2000" },
  { value: "over_2000", label: "I'm pretty good! (2000+)" },
  { value: "prefer_not_say", label: "Prefer not to say" },
] as const

export type RatingBandValue = (typeof RATING_BANDS)[number]["value"]

/** Map band to approximate number for pairing. null = unrated / prefer not say. */
export function ratingBandToNumber(band: RatingBandValue | null | undefined): number | null {
  if (!band || band === "unrated" || band === "prefer_not_say") return null
  switch (band) {
    case "around_1500":
      return 1500
    case "around_2000":
      return 1900
    case "over_2000":
      return 2100
    default:
      return null
  }
}

/** Resolve player rating: use precise if set, else from band. */
export function resolveRating(
  precise: number | null | undefined,
  band: RatingBandValue | null | undefined,
): number | null {
  if (precise != null && precise > 0) return precise
  return ratingBandToNumber(band)
}
