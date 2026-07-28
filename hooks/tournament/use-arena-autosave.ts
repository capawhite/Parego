"use client"

import { useEffect } from "react"
import { saveTournament } from "@/lib/database/tournament-db"
import { settingsForPersistence } from "@/lib/tournament-settings"
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

/** Debounced organizer autosave of tournament metadata/settings only.
 * Player scores are never written here (server-owned via match APIs / organizer actions).
 */
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
  // Exclude ephemeral heartbeat so pair ticks don't retrigger settings writes.
  const settingsPersistKey = JSON.stringify(settingsForPersistence(arenaState.settings))

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
          settingsForPersistence(arenaState.settings),
          tournamentMetadata?.city,
          tournamentMetadata?.country,
          organizerId ?? currentUserId ?? undefined,
          tournamentMetadata?.latitude,
          tournamentMetadata?.longitude,
          tournamentMetadata?.visibility ?? "public",
          startTimeIso,
        )
        if (DEBUG) console.log("[v0] Tournament auto-saved to database")
      } catch (error) {
        console.error("[v0] Error auto-saving tournament:", error)
      }
    }

    const debounceTimer = setTimeout(saveToDatabase, 1000)
    return () => clearTimeout(debounceTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settingsPersistKey stands in for settings
  }, [
    tournamentId,
    displayName,
    arenaState.isActive,
    arenaState.tableCount,
    settingsPersistKey,
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
