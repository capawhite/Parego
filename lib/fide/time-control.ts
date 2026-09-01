import type { FideRatings } from "@/lib/fide/types"
import { pickFideRating } from "@/lib/fide/rating"
import { ratingBandToNumber, type RatingBandValue } from "@/lib/rating-bands"

/** FIDE rating-list category from tournament time control (B02RB regulations, March 2024). */
export type FideTimeControlCategory = "blitz" | "rapid" | "standard" | "unknown"

export type TimeControlInput = {
  baseTimeMinutes?: number | null
  incrementSeconds?: number | null
}

/**
 * FIDE effective thinking time per player for classification:
 * base minutes + increment seconds (60 moves × increment / 60).
 */
export function effectiveFideMinutes(
  baseTimeMinutes?: number | null,
  incrementSeconds?: number | null,
): number | null {
  if (baseTimeMinutes == null || baseTimeMinutes < 0) return null
  const increment = incrementSeconds ?? 0
  if (increment < 0) return null
  return baseTimeMinutes + increment
}

/**
 * Classify a tournament's time control for FIDE rating-list purposes.
 * - Blitz: > 3 and ≤ 10 minutes effective
 * - Rapid: > 10 and < 60 minutes effective
 * - Standard: ≥ 60 minutes effective (club default; FIDE rated standard has higher floors by strength)
 */
export function classifyFideTimeControl(
  baseTimeMinutes?: number | null,
  incrementSeconds?: number | null,
): FideTimeControlCategory {
  const effective = effectiveFideMinutes(baseTimeMinutes, incrementSeconds)
  if (effective == null) return "unknown"
  if (effective > 3 && effective <= 10) return "blitz"
  if (effective > 10 && effective < 60) return "rapid"
  if (effective >= 60) return "standard"
  return "unknown"
}

export function fideRatingForCategory(
  ratings: FideRatings,
  category: FideTimeControlCategory,
): number | null {
  switch (category) {
    case "blitz":
      return ratings.blitz
    case "rapid":
      return ratings.rapid
    case "standard":
      return ratings.standard
    default:
      return null
  }
}

export type ResolvePairingRatingInput = {
  /** User-typed rating override (join form, etc.). */
  manualRating?: number | null
  ratingBand?: RatingBandValue | string | null
  fideRatings?: FideRatings | null
  /** Legacy single rating on profile (often standard from FIDE link). */
  profileRating?: number | null
  baseTimeMinutes?: number | null
  incrementSeconds?: number | null
}

/**
 * Pick the rating used for pairing when a player joins a tournament.
 * Prefers manual override, then FIDE rating matching the time control, then profile/band fallbacks.
 */
export function resolvePairingRating(input: ResolvePairingRatingInput): number | null {
  if (input.manualRating != null && input.manualRating > 0) {
    return input.manualRating
  }

  const category = classifyFideTimeControl(input.baseTimeMinutes, input.incrementSeconds)
  const fideRatings = input.fideRatings ?? { standard: null, rapid: null, blitz: null }

  if (category !== "unknown") {
    const forCategory = fideRatingForCategory(fideRatings, category)
    if (forCategory != null && forCategory > 0) return forCategory
  }

  // Unknown TC or missing FIDE rating for this TC — avoid using standard profile rating in blitz/rapid.
  if (category === "standard" || category === "unknown") {
    if (input.profileRating != null && input.profileRating > 0) return input.profileRating
    const anyFide = pickFideRating(fideRatings)
    if (anyFide != null) return anyFide
  }

  return ratingBandToNumber(input.ratingBand as RatingBandValue | null | undefined)
}
