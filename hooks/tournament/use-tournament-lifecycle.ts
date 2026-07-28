"use client"

import { useCallback } from "react"
import { startTournament as startTournamentAction } from "@/app/actions/start-tournament"

type UseTournamentLifecycleOptions = {
  tournamentId: string | null
  onStarted?: () => void
  onError?: (message: string) => void
}

/**
 * Organizer lifecycle helpers (start via server action).
 * End/finalize remain in ArenaPanel until further extraction.
 */
export function useTournamentLifecycle({
  tournamentId,
  onStarted,
  onError,
}: UseTournamentLifecycleOptions) {
  const start = useCallback(async () => {
    if (!tournamentId) return { success: false as const, error: "Missing tournament id" }
    try {
      const result = await startTournamentAction(tournamentId)
      if (result.success) onStarted?.()
      else onError?.(result.error ?? "Failed to start")
      return result
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      onError?.(msg)
      return { success: false as const, error: msg }
    }
  }, [tournamentId, onStarted, onError])

  return { start }
}
