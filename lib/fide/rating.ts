import type { FidePlayer, FideRatings } from "@/lib/fide/types"
import type { SimpleLevelValue } from "@/lib/rating-bands"

/** Prefer standard, then rapid, then blitz — used as default pairing rating. */
export function pickFideRating(player: Pick<FidePlayer, "standard" | "rapid" | "blitz">): number | null {
  if (player.standard != null && player.standard > 0) return player.standard
  if (player.rapid != null && player.rapid > 0) return player.rapid
  if (player.blitz != null && player.blitz > 0) return player.blitz
  return null
}

export function extractFideRatings(player: Pick<FidePlayer, "standard" | "rapid" | "blitz">): FideRatings {
  return {
    standard: player.standard != null && player.standard > 0 ? player.standard : null,
    rapid: player.rapid != null && player.rapid > 0 ? player.rapid : null,
    blitz: player.blitz != null && player.blitz > 0 ? player.blitz : null,
  }
}

export function formatFideRatingsSummary(
  ratings: FideRatings,
  labels: { standard: string; rapid: string; blitz: string },
): string {
  const parts: string[] = []
  if (ratings.standard != null) parts.push(`${labels.standard} ${ratings.standard}`)
  if (ratings.rapid != null) parts.push(`${labels.rapid} ${ratings.rapid}`)
  if (ratings.blitz != null) parts.push(`${labels.blitz} ${ratings.blitz}`)
  return parts.length > 0 ? parts.join(" • ") : "—"
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

export function fideSelectionToDbFields(selection: {
  fideId: number
  fideTitle: string | null
  ratings: FideRatings
} | null) {
  if (!selection) {
    return {
      fide_id: null as number | null,
      fide_title: null as string | null,
      fide_standard: null as number | null,
      fide_rapid: null as number | null,
      fide_blitz: null as number | null,
    }
  }
  return {
    fide_id: selection.fideId,
    fide_title: selection.fideTitle,
    fide_standard: selection.ratings.standard,
    fide_rapid: selection.ratings.rapid,
    fide_blitz: selection.ratings.blitz,
  }
}
