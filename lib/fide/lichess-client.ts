import type { FidePlayer } from "@/lib/fide/types"

const LICHESS_FIDE_SEARCH = "https://lichess.org/api/fide/player"

export async function searchFidePlayers(query: string): Promise<FidePlayer[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const url = new URL(LICHESS_FIDE_SEARCH)
  url.searchParams.set("q", q)

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  })

  if (!response.ok) {
    throw new Error(`FIDE search failed (${response.status})`)
  }

  const data: unknown = await response.json()
  if (!Array.isArray(data)) return []

  return data
    .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
    .map((item) => ({
      id: Number(item.id),
      name: String(item.name ?? ""),
      federation: item.federation != null ? String(item.federation) : null,
      year: typeof item.year === "number" ? item.year : null,
      title: item.title != null ? String(item.title) : null,
      standard: typeof item.standard === "number" ? item.standard : null,
      rapid: typeof item.rapid === "number" ? item.rapid : null,
      blitz: typeof item.blitz === "number" ? item.blitz : null,
      inactive: item.inactive === true,
    }))
    .filter((p) => Number.isFinite(p.id) && p.id > 0 && p.name.length > 0)
}
