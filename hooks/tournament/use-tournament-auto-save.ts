"use client"

import { useEffect, useRef } from "react"
import { saveTournament, savePlayers } from "@/lib/database/tournament-db"
import type { ArenaState, TournamentSettings } from "@/lib/types"
import type { TournamentMetadata } from "./use-tournament-load"

const DEBUG = process.env.NODE_ENV === "development"

export interface AutoSaveParams {
  tournamentId: string | null
  displayName: string
  arenaState: ArenaState
  tournamentMetadata: TournamentMetadata | null
  organizerId: string | null
  isLoading: boolean
  /**
   * Called immediately before each DB write (debounced or immediate).
   * Use this to arm the Realtime suppression window so echoed events
   * don't overwrite in-flight local state.
   */
  onBeforeSave?: () => void
}

export interface SaveNowParams {
  status?: "setup" | "active" | "completed"
  startTimeIso?: string
}

export function useTournamentAutoSave(params: AutoSaveParams): {
  saveNow: (overrides?: SaveNowParams) => Promise<void>
} {
  const paramsRef = useRef(params)
  paramsRef.current = params

  useEffect(() => {
    const { tournamentId, isLoading } = params
    if (!tournamentId || isLoading) return

    const saveToDatabase = async () => {
      const {
        tournamentId: tid,
        displayName,
        arenaState,
        tournamentMetadata,
        organizerId,
        onBeforeSave,
      } = paramsRef.current

      if (!tid) return

      try {
        onBeforeSave?.()
        const statusToSave =
          arenaState.status === "completed" ? "completed" : arenaState.isActive ? "active" : "setup"
        const startTimeIso =
          arenaState.tournamentStartTime != null
            ? typeof arenaState.tournamentStartTime === "number"
              ? new Date(arenaState.tournamentStartTime).toISOString()
              : String(arenaState.tournamentStartTime)
            : undefined

        await saveTournament(
          tid,
          displayName,
          statusToSave,
          arenaState.tableCount,
          arenaState.settings,
          tournamentMetadata?.city,
          tournamentMetadata?.country,
          organizerId ?? undefined,
          tournamentMetadata?.latitude,
          tournamentMetadata?.longitude,
          tournamentMetadata?.visibility ?? "public",
          startTimeIso,
        )
        await savePlayers(tid, arenaState.players)
        if (DEBUG) console.log("[arena] Auto-saved tournament")
      } catch (error) {
        console.error("[arena] Error auto-saving tournament:", error)
      }
    }

    const debounceTimer = setTimeout(saveToDatabase, 1000)
    return () => clearTimeout(debounceTimer)
  }, [
    params.tournamentId,
    params.displayName,
    params.arenaState.players,
    params.arenaState.isActive,
    params.arenaState.tableCount,
    params.arenaState.settings,
    params.arenaState.tournamentDuration,
    params.arenaState.status,
    params.arenaState.tournamentStartTime,
    params.tournamentMetadata,
    params.organizerId,
    params.isLoading,
  ])

  const saveNow = async (overrides?: SaveNowParams) => {
    const {
      tournamentId: tid,
      displayName,
      arenaState,
      tournamentMetadata,
      organizerId,
      onBeforeSave,
    } = paramsRef.current

    if (!tid) return

    try {
      onBeforeSave?.()
      const statusToSave = overrides?.status ?? (arenaState.status === "completed" ? "completed" : arenaState.isActive ? "active" : "setup")
      const startTimeIso =
        overrides?.startTimeIso ??
        (arenaState.tournamentStartTime != null
          ? typeof arenaState.tournamentStartTime === "number"
            ? new Date(arenaState.tournamentStartTime).toISOString()
            : String(arenaState.tournamentStartTime)
          : undefined)

      await saveTournament(
        tid,
        displayName,
        statusToSave,
        arenaState.tableCount,
        arenaState.settings,
        tournamentMetadata?.city,
        tournamentMetadata?.country,
        organizerId ?? undefined,
        tournamentMetadata?.latitude,
        tournamentMetadata?.longitude,
        tournamentMetadata?.visibility ?? "public",
        startTimeIso,
      )
    } catch (error) {
      console.error("[arena] Error in saveNow:", error)
    }
  }

  return { saveNow }
}
