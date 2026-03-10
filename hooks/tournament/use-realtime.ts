"use client"

import { useEffect, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { loadPlayers, loadMatches } from "@/lib/database/tournament-db"
import type { ArenaState, Match } from "@/lib/types"

const DEBUG = process.env.NODE_ENV === "development"

/** How long (ms) to suppress incoming Realtime events after a local write. */
const SUPPRESS_WINDOW_MS = 2000

export interface UseRealtimeOptions {
  /**
   * Tournament ID to subscribe to. Pass null to skip subscription
   * (e.g. while the initial load is still running).
   */
  tournamentId: string | null
  /**
   * Only subscribe once the initial one-shot load is complete.
   * Prevents Realtime from firing before local state is initialised.
   */
  isReady: boolean
  setArenaState: React.Dispatch<React.SetStateAction<ArenaState>>
  /**
   * Called when the tournament row's `status` column changes on another device.
   * Useful for transitioning setup → active without a full reload.
   */
  onTournamentStatusChange?: (status: "setup" | "active" | "completed") => void
  /**
   * The local player's ID. When provided, `onNewPairing` fires whenever a
   * new match involving this player appears in the Realtime update.
   */
  currentPlayerId?: string | null
  /**
   * Called when the local player is paired into a new match.
   * Use this to fire toast / browser notifications.
   */
  onNewPairing?: (match: Match) => void
}

/**
 * Subscribes to Supabase Realtime `postgres_changes` events for the three
 * core tables (players, matches, tournaments) scoped to one tournament.
 *
 * Returns `suppressRealtime()` — call this right before any local DB write so
 * that the echoed Realtime event doesn't overwrite in-flight state changes.
 */
export function useRealtime({
  tournamentId,
  isReady,
  setArenaState,
  onTournamentStatusChange,
  currentPlayerId,
  onNewPairing,
}: UseRealtimeOptions): { suppressRealtime: () => void } {
  const suppressUntil = useRef<number>(0)

  const suppressRealtime = useCallback(() => {
    suppressUntil.current = Date.now() + SUPPRESS_WINDOW_MS
    if (DEBUG) console.log("[realtime] suppression armed until", new Date(suppressUntil.current).toISOString())
  }, [])

  useEffect(() => {
    if (!tournamentId || !isReady) return

    const supabase = createClient()

    const channel = supabase
      .channel(`tournament:${tournamentId}`)

      // ── Players ──────────────────────────────────────────────────────────
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        async () => {
          if (Date.now() < suppressUntil.current) {
            if (DEBUG) console.log("[realtime] players event suppressed (local write in flight)")
            return
          }
          if (DEBUG) console.log("[realtime] players changed — re-fetching")
          try {
            const players = await loadPlayers(tournamentId)
            setArenaState((prev) => {
              const prevIds = prev.players.map((p) => `${p.id}:${p.name}:${p.score}:${p.paused}`).join(",")
              const newIds = players.map((p) => `${p.id}:${p.name}:${p.score}:${p.paused}`).join(",")
              if (prevIds === newIds && prev.players.length === players.length) {
                if (DEBUG) console.log("[realtime] players unchanged — skipping state update")
                return prev
              }
              return { ...prev, players }
            })
          } catch (err) {
            console.error("[realtime] failed to refresh players:", err)
          }
        },
      )

      // ── Matches ───────────────────────────────────────────────────────────
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        async () => {
          if (Date.now() < suppressUntil.current) {
            if (DEBUG) console.log("[realtime] matches event suppressed (local write in flight)")
            return
          }
          if (DEBUG) console.log("[realtime] matches changed — re-fetching")
          try {
            const allMatches = await loadMatches(tournamentId)
            const pairedMatches = allMatches.filter((m) => !m.result?.completed)
            const allTimeMatches = allMatches.filter((m) => !!m.result?.completed)

            setArenaState((prev) => {
              // Skip no-op updates to avoid re-render / effect cascades
              const prevPairedIds = prev.pairedMatches.map((m) => m.id).sort().join(",")
              const newPairedIds = pairedMatches.map((m) => m.id).sort().join(",")
              const prevAllTimeLen = prev.allTimeMatches.length
              const noChange = prevPairedIds === newPairedIds && prevAllTimeLen === allTimeMatches.length
              if (noChange) {
                if (DEBUG) console.log("[realtime] matches unchanged — skipping state update")
                return prev
              }

              // Detect if the local player has been placed into a new match
              if (currentPlayerId && onNewPairing) {
                const prevIds = new Set(prev.pairedMatches.map((m) => m.id))
                const newMatch = pairedMatches.find(
                  (m) =>
                    !prevIds.has(m.id) &&
                    (m.player1.id === currentPlayerId || m.player2.id === currentPlayerId),
                )
                if (newMatch) {
                  if (DEBUG) console.log("[realtime] new pairing detected for player", currentPlayerId)
                  setTimeout(() => onNewPairing(newMatch), 0)
                }
              }

              return { ...prev, pairedMatches, allTimeMatches }
            })
          } catch (err) {
            console.error("[realtime] failed to refresh matches:", err)
          }
        },
      )

      // ── Tournament row ────────────────────────────────────────────────────
      // Only UPDATE events — we don't need to react to INSERT/DELETE here.
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tournaments",
          filter: `id=eq.${tournamentId}`,
        },
        (payload) => {
          if (Date.now() < suppressUntil.current) {
            if (DEBUG) console.log("[realtime] tournament event suppressed (local write in flight)")
            return
          }
          const row = payload.new as Record<string, unknown>
          const newStatus = row.status as "setup" | "active" | "completed"
          if (DEBUG) console.log("[realtime] tournament status →", newStatus)

          setArenaState((prev) => {
            if (prev.status === newStatus) return prev
            return {
              ...prev,
              status: newStatus,
              isActive: newStatus === "active",
            }
          })

          onTournamentStatusChange?.(newStatus)
        },
      )

      .subscribe((status, err) => {
        if (DEBUG) console.log("[realtime] channel status:", status, err ?? "")
      })

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, isReady])

  return { suppressRealtime }
}
