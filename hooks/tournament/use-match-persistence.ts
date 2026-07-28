"use client"

import { useEffect } from "react"
import type { ArenaState, Match } from "@/lib/types"
import { saveMatches } from "@/lib/database/tournament-db"
import { formatSupabaseError } from "@/lib/database/tournament-db"

type UseMatchPersistenceOptions = {
  tournamentId: string | null
  isOrganizer: boolean
  isActive: boolean
  pairedMatches: Match[]
  suppressRealtime: () => void
  /** When server pairing owns inserts, skip client save of active matches. */
  serverOwnsPairingWrites?: boolean
}

/**
 * Organizer persistence for active matches. No-op when server pairing API owns inserts.
 */
export function useMatchPersistence({
  tournamentId,
  isOrganizer,
  isActive,
  pairedMatches,
  suppressRealtime,
  serverOwnsPairingWrites = true,
}: UseMatchPersistenceOptions): void {
  useEffect(() => {
    if (serverOwnsPairingWrites) return
    if (!tournamentId || !isActive || !isOrganizer) return

    const activeMatches = pairedMatches.filter((m) => !m.result?.completed)
    if (activeMatches.length > 0) {
      suppressRealtime()
      saveMatches(tournamentId, activeMatches).catch((err) =>
        console.error("[match-persistence] Failed to save active matches:", formatSupabaseError(err)),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- length-only dep: avoid save spam
  }, [
    pairedMatches.length,
    tournamentId,
    isActive,
    isOrganizer,
    suppressRealtime,
    serverOwnsPairingWrites,
  ])
}

export type { ArenaState }
