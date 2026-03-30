import type { Match } from "@/lib/types"
import { matchEffectiveEndMs } from "./arena-t1"

export interface PlayerMatchCacheEntry {
  lastGameEndMs: number | null
  lastCompletedMatch: Match | undefined
}

export type PlayerMatchCache = Map<string, PlayerMatchCacheEntry>

/**
 * Single O(M) pass through matches to build per-player last-game data.
 * Replaces repeated O(M) or O(M log M) scans that previously ran per-player or per-pair.
 */
export function buildPlayerMatchCache(matches: Match[]): PlayerMatchCache {
  const cache: PlayerMatchCache = new Map()

  for (const m of matches) {
    if (!m.result?.completed) continue
    const et = matchEffectiveEndMs(m)

    for (const pid of [m.player1.id, m.player2.id]) {
      let entry = cache.get(pid)
      if (!entry) {
        entry = { lastGameEndMs: null, lastCompletedMatch: undefined }
        cache.set(pid, entry)
      }
      if (et != null && (entry.lastGameEndMs == null || et > entry.lastGameEndMs)) {
        entry.lastGameEndMs = et
        entry.lastCompletedMatch = m
      }
    }
  }

  return cache
}

export function getCacheEntry(cache: PlayerMatchCache, playerId: string): PlayerMatchCacheEntry {
  return cache.get(playerId) ?? { lastGameEndMs: null, lastCompletedMatch: undefined }
}
