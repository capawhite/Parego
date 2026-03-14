/**
 * Simple level options for registration and join. Used in signup, join, and profile.
 */
export const SIMPLE_LEVELS = [
  { value: "beginner", labelKey: "levels.beginner" },
  { value: "intermediate", labelKey: "levels.intermediate" },
  { value: "advanced", labelKey: "levels.advanced" },
] as const

export type SimpleLevelValue = (typeof SIMPLE_LEVELS)[number]["value"]

/**
 * Legacy rating bands (profile may still store these). Prefer SIMPLE_LEVELS for new flows.
 */
export const RATING_BANDS = [
  { value: "unrated", label: "I'm too weak to know" },
  { value: "around_1500", label: "I once heard I was about 1500" },
  { value: "around_2000", label: "I'm almost 2000" },
  { value: "over_2000", label: "I'm pretty good! (2000+)" },
  { value: "prefer_not_say", label: "Prefer not to say" },
] as const

export type RatingBandValue =
  | (typeof RATING_BANDS)[number]["value"]
  | SimpleLevelValue

/** Map band to approximate number for pairing. Handles simple levels and legacy bands. */
export function ratingBandToNumber(band: RatingBandValue | null | undefined): number | null {
  if (!band) return null
  switch (band) {
    case "beginner":
      return 1000
    case "intermediate":
      return 1500
    case "advanced":
      return 1900
    case "unrated":
    case "prefer_not_say":
      return null
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
