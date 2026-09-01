import type { FidePlayer } from "@/lib/fide/types"
import type { SimpleLevelValue } from "@/lib/rating-bands"

/** Prefer standard, then rapid, then blitz. */
export function pickFideRating(player: Pick<FidePlayer, "standard" | "rapid" | "blitz">): number | null {
  if (player.standard != null && player.standard > 0) return player.standard
  if (player.rapid != null && player.rapid > 0) return player.rapid
  if (player.blitz != null && player.blitz > 0) return player.blitz
  return null
}

/** Map a FIDE rating to our simple signup/profile bands. */
export function fideRatingToBand(rating: number): SimpleLevelValue {
  if (rating >= 2000) return "advanced"
  if (rating >= 1400) return "intermediate"
  return "beginner"
}

/** "Carlsen, Magnus" → "Magnus Carlsen" when comma-separated. */
export function formatFideDisplayName(name: string): string {
  const comma = name.indexOf(",")
  if (comma === -1) return name.trim()
  const last = name.slice(0, comma).trim()
  const first = name.slice(comma + 1).trim()
  if (!first || !last) return name.trim()
  return `${first} ${last}`
}
