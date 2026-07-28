"use client"

import { useEffect, useRef } from "react"
import { getPairingAlgorithm } from "@/lib/pairing"
import { shouldRunPairingLoop } from "@/lib/tournament/pairing-loop-gate"

type UsePairingLoopOptions = {
  tournamentId: string | null
  isOrganizer: boolean
  isActive: boolean
  waitingForFinalResults: boolean
  pairingAlgorithm?: string | null
  /**
   * When true, call POST /api/tournament/:id/pair instead of local createPairings.
   * Realtime delivers new matches to all clients.
   */
  useServerPairing?: boolean
}

/**
 * Organizer-only pairing poller. Prefer server pair API; no client createPairings writes.
 */
export function usePairingLoop({
  tournamentId,
  isOrganizer,
  isActive,
  waitingForFinalResults,
  pairingAlgorithm,
  useServerPairing = true,
}: UsePairingLoopOptions): void {
  const waitingRef = useRef(waitingForFinalResults)
  waitingRef.current = waitingForFinalResults

  useEffect(() => {
    if (
      !shouldRunPairingLoop({
        isOrganizer,
        isActive,
        waitingForFinalResults,
        pairingAlgorithm,
      })
    ) {
      return
    }
    if (!tournamentId || !useServerPairing) return

    const algorithm = getPairingAlgorithm(pairingAlgorithm || "all-vs-all")
    // Floor the poll: the server pair tick does a full field reload, the 1-min cron
    // covers organizer-absent arenas, and Realtime delivers new matches to clients.
    const MIN_SERVER_POLL_MS = 15_000
    const intervalMs = Math.max(algorithm.getPollingInterval(), MIN_SERVER_POLL_MS)

    const tick = () => {
      if (waitingRef.current) return
      void fetch(`/api/tournament/${tournamentId}/pair`, { method: "POST" }).catch((err) => {
        if (process.env.NODE_ENV === "development") {
          console.error("[pairing-loop] pair request failed:", err)
        }
      })
    }

    tick()
    const id = setInterval(tick, intervalMs)
    return () => clearInterval(id)
  }, [
    tournamentId,
    isOrganizer,
    isActive,
    waitingForFinalResults,
    pairingAlgorithm,
    useServerPairing,
  ])
}
