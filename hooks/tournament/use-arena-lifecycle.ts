"use client"

import { useCallback, type Dispatch, type SetStateAction } from "react"
import { toast } from "sonner"
import { finalizeTournament } from "@/app/actions/finalize-tournament"
import { formatSupabaseError, saveTournament } from "@/lib/database/tournament-db"
import type { ArenaState } from "@/lib/types"
import type { useI18n } from "@/components/i18n-provider"
import {
  isSwissAlgorithm,
  MIN_SWISS_PLAYERS,
  maxSwissRoundsForPlayerCount,
  validateSwissTournamentField,
} from "@/lib/pairing/swiss"

type TFunction = ReturnType<typeof useI18n>["t"]

const DEBUG = process.env.NODE_ENV === "development"

type TournamentMetadata = {
  city?: string
  country?: string
  latitude?: number
  longitude?: number
  visibility?: "public" | "private"
}

type UseArenaLifecycleOptions = {
  tournamentId: string | null
  arenaState: ArenaState
  setArenaState: Dispatch<SetStateAction<ArenaState>>
  displayName: string
  tableCountInput: string
  tournamentDurationInput: string
  tournamentMetadata: TournamentMetadata | null
  organizerId: string | null
  currentUserId: string | null
  suppressRealtime?: () => void
  startTournamentLifecycle: () => Promise<{ success: boolean; error?: string }>
  setTimeRemaining: Dispatch<SetStateAction<number>>
  setActiveTab: Dispatch<SetStateAction<string>>
  setShowEndDialog: Dispatch<SetStateAction<boolean>>
  setWaitingForFinalResults: Dispatch<SetStateAction<boolean>>
  setShowPodium: Dispatch<SetStateAction<boolean>>
  t: TFunction
}

/**
 * Organizer start / end / finalize flows for ArenaPanel.
 */
export function useArenaLifecycle({
  tournamentId,
  arenaState,
  setArenaState,
  displayName,
  tableCountInput,
  tournamentDurationInput,
  tournamentMetadata,
  organizerId,
  currentUserId,
  suppressRealtime,
  startTournamentLifecycle,
  setTimeRemaining,
  setActiveTab,
  setShowEndDialog,
  setWaitingForFinalResults,
  setShowPodium,
  t,
}: UseArenaLifecycleOptions) {
  const handleStartTournament = useCallback(async () => {
    if (arenaState.status === "completed") {
      toast.error(t("arena.alertTournamentAlreadyCompleted"))
      return
    }

    if (isSwissAlgorithm(arenaState.settings.pairingAlgorithm)) {
      const activeCount = arenaState.players.filter((p) => !p.hasLeft).length
      const check = validateSwissTournamentField(arenaState.settings, activeCount)
      if (!check.valid) {
        if (activeCount < MIN_SWISS_PLAYERS) {
          toast.error(t("arena.alertSwissNeedPlayers", { min: MIN_SWISS_PLAYERS, count: activeCount }))
        } else {
          const maxR = maxSwissRoundsForPlayerCount(activeCount)
          toast.error(
            t("arena.alertSwissRoundsVsPlayers", {
              players: activeCount,
              rounds: arenaState.settings.plannedSwissRounds ?? 0,
              max: maxR,
            }),
          )
        }
        return
      }
    } else if (arenaState.players.length < 2) {
      toast.error(t("arena.alertNeedAtLeastTwoPlayers"))
      return
    }

    const tableCount = Number.parseInt(tableCountInput)
    if (!tableCount || tableCount < 1) {
      toast.error(t("arena.alertInvalidTableCount"))
      return
    }

    const maxSimultaneousPairings = Math.floor(arenaState.players.length / 2)
    if (tableCount < maxSimultaneousPairings) {
      toast.error(
        t("arena.alertNotEnoughTables", {
          players: arenaState.players.length,
          tables: maxSimultaneousPairings,
        }),
      )
      return
    }

    const durationMinutes = Number.parseInt(tournamentDurationInput)
    if (!durationMinutes || durationMinutes < 1) {
      toast.error(t("arena.alertInvalidDurationMinutes"))
      return
    }
    const durationMs = durationMinutes * 60 * 1000

    if (!tournamentId) {
      console.error("[v0] No tournament ID available - this should not happen with new routing")
      return
    }

    try {
      const result = await startTournamentLifecycle()
      if (!result.success) {
        toast.error(result.error || t("arena.alertStartTournamentFailed"))
        return
      }
    } catch (error) {
      console.error("[v0] Error calling startTournament action:", error)
      toast.error(t("arena.alertStartTournamentFailed"))
      return
    }

    const newTables = tableCount > 0 ? tableCount : Math.floor(arenaState.players.length / 2)
    const startTimeMs = Date.now()

    try {
      suppressRealtime?.()
      await saveTournament(
        tournamentId,
        displayName,
        "active",
        newTables,
        {
          ...arenaState.settings,
          tableCount: newTables,
          arenaDurationMinutes: durationMinutes,
        },
        tournamentMetadata?.city,
        tournamentMetadata?.country,
        organizerId ?? currentUserId ?? undefined,
        tournamentMetadata?.latitude,
        tournamentMetadata?.longitude,
        tournamentMetadata?.visibility ?? "public",
        new Date(startTimeMs).toISOString(),
      )
    } catch (err) {
      console.error("[v0] Failed to persist tables_count after start:", formatSupabaseError(err))
    }

    setArenaState((prev) => ({
      ...prev,
      status: "active",
      isActive: true,
      tableCount: newTables,
      settings: {
        ...prev.settings,
        tableCount: newTables,
        arenaDurationMinutes: durationMinutes,
      },
      tournamentStartTime: startTimeMs,
      tournamentDuration: durationMs,
    }))
    setTimeRemaining(durationMs)
    setActiveTab("pairings")
  }, [
    arenaState.status,
    arenaState.players.length,
    arenaState.settings,
    tableCountInput,
    tournamentDurationInput,
    tournamentId,
    startTournamentLifecycle,
    suppressRealtime,
    displayName,
    tournamentMetadata,
    organizerId,
    currentUserId,
    setArenaState,
    setTimeRemaining,
    setActiveTab,
    t,
  ])

  const endTournament = useCallback(() => {
    setShowEndDialog(true)
  }, [setShowEndDialog])

  const finalizeEndTournament = useCallback(async () => {
    setShowPodium(true)
    setArenaState((prev) => ({
      ...prev,
      isActive: false,
      status: "completed",
      pairedMatches: [],
    }))
    setWaitingForFinalResults(false)

    if (!tournamentId) return

    try {
      suppressRealtime?.()
      // Status-only server finalize: match results and scores are already
      // persisted server-side, so no client match snapshot is written here.
      const res = await finalizeTournament(tournamentId)
      if (!res.success) {
        console.error("[v0] Error finalizing tournament:", res.error)
        toast.error(res.error || t("arena.alertStartTournamentFailed"))
        return
      }
      if (DEBUG) console.log("[v0] Tournament ended and saved as completed")
    } catch (error) {
      console.error("[v0] Error saving tournament end:", error)
    }
  }, [
    tournamentId,
    suppressRealtime,
    setShowPodium,
    setArenaState,
    setWaitingForFinalResults,
    t,
  ])

  const handleEndImmediately = useCallback(async () => {
    setShowEndDialog(false)
    await finalizeEndTournament()
  }, [setShowEndDialog, finalizeEndTournament])

  const handleWaitForFinalResults = useCallback(() => {
    setShowEndDialog(false)
    setWaitingForFinalResults(true)
  }, [setShowEndDialog, setWaitingForFinalResults])

  return {
    handleStartTournament,
    endTournament,
    handleEndImmediately,
    handleWaitForFinalResults,
    finalizeEndTournament,
  }
}
