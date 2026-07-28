"use client"

import { useEffect } from "react"
import { savePlayers, saveTournament } from "@/lib/database/tournament-db"
import type { ArenaState } from "@/lib/types"

const DEBUG = process.env.NODE_ENV === "development"

type TournamentMetadata = {
  city?: string
  country?: string
  latitude?: number
  longitude?: number
  visibility?: "public" | "private"
}

type UseArenaAutosaveOptions = {
  tournamentId: string | null
  isLoading: boolean
  isOrganizer: boolean
  displayName: string
  arenaState: ArenaState
  tournamentMetadata: TournamentMetadata | null
  organizerId: string | null
  currentUserId: string | null
  suppressRealtime: () => void
}

/** Debounced organizer autosave of tournament + players. */
export function useArenaAutosave({
  tournamentId,
  isLoading,
  isOrganizer,
  displayName,
  arenaState,
  tournamentMetadata,
  organizerId,
  currentUserId,
  suppressRealtime,
}: UseArenaAutosaveOptions): void {
  useEffect(() => {
    if (!tournamentId || isLoading || !isOrganizer) return

    const saveToDatabase = async () => {
      try {
        suppressRealtime()
        const statusToSave =
          arenaState.status === "completed" ? "completed" : arenaState.isActive ? "active" : "setup"
        const startTimeIso =
          arenaState.tournamentStartTime != null
            ? typeof arenaState.tournamentStartTime === "number"
              ? new Date(arenaState.tournamentStartTime).toISOString()
              : String(arenaState.tournamentStartTime)
            : undefined

        await saveTournament(
          tournamentId,
          displayName,
          statusToSave,
          arenaState.tableCount,
          arenaState.settings,
          tournamentMetadata?.city,
          tournamentMetadata?.country,
          organizerId ?? currentUserId ?? undefined,
          tournamentMetadata?.latitude,
          tournamentMetadata?.longitude,
          tournamentMetadata?.visibility ?? "public",
          startTimeIso,
        )
        await savePlayers(tournamentId, arenaState.players, arenaState.settings)
        if (DEBUG) console.log("[v0] Tournament auto-saved to database")
      } catch (error) {
        console.error("[v0] Error auto-saving tournament:", error)
      }
    }

    const debounceTimer = setTimeout(saveToDatabase, 1000)
    return () => clearTimeout(debounceTimer)
  }, [
    tournamentId,
    displayName,
    arenaState.players,
    arenaState.isActive,
    arenaState.tableCount,
    arenaState.settings,
    arenaState.tournamentDuration,
    arenaState.status,
    arenaState.tournamentStartTime,
    tournamentMetadata,
    organizerId,
    currentUserId,
    isLoading,
    isOrganizer,
    suppressRealtime,
  ])
}
