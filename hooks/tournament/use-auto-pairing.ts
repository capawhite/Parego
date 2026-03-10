"use client"

import { useEffect } from "react"
import { getPairingAlgorithm } from "@/lib/pairing"
import { saveMatches } from "@/lib/database/tournament-db"
import type { ArenaState, Match, TournamentSettings } from "@/lib/types"
import type { TournamentMetadata } from "./use-tournament-load"

const DEBUG = process.env.NODE_ENV === "development"

export interface AutoPairingParams {
  isActive: boolean
  pairedMatches: Match[]
  players: ArenaState["players"]
  allTimeMatches: Match[]
  tableCount: number
  settings: TournamentSettings
  tournamentMetadata: TournamentMetadata | null
  waitingForFinalResults: boolean
  tournamentId: string | null
  getOccupiedTables: () => number[]
  assignTablesToMatches: (matches: Match[]) => Match[]
  onNewMatches: (matches: Match[]) => void
  /** Called before each DB write to arm the Realtime suppression window. */
  onBeforeSave?: () => void
}

export function useAutoPairing(params: AutoPairingParams) {
  const {
    isActive,
    pairedMatches,
    players,
    allTimeMatches,
    tableCount,
    settings,
    tournamentMetadata,
    waitingForFinalResults,
    tournamentId,
    getOccupiedTables,
    assignTablesToMatches,
    onNewMatches,
    onBeforeSave,
  } = params

  // Auto-pairing engine
  useEffect(() => {
    if (!isActive || waitingForFinalResults) return

    const algorithmId = settings.pairingAlgorithm || "all-vs-all"
    const algorithm = getPairingAlgorithm(algorithmId)

    const pairingTimer = setInterval(() => {
      const activePairingMatches = pairedMatches.filter((m) => !m.result?.completed)
      const hasVenue = tournamentMetadata?.latitude != null && tournamentMetadata?.longitude != null
      const availablePlayers = players.filter(
        (p) =>
          !p.paused &&
          !p.markedForRemoval &&
          !p.markedForPause &&
          (p.checkedInAt != null || !hasVenue) &&
          !activePairingMatches.some((m) => m.player1.id === p.id || m.player2.id === p.id),
      )

      const occupiedTables = getOccupiedTables()
      const availableTables = tableCount - occupiedTables.length

      if (DEBUG)
        console.log(`[arena] ${algorithm.name}: Pairing check`, {
          availablePlayers: availablePlayers.length,
          activeMatches: activePairingMatches.length,
          availableTables,
        })

      if (algorithm.shouldPair(availablePlayers, activePairingMatches, players.length, availableTables)) {
        const maxMatches = Math.min(availableTables, Math.floor(availablePlayers.length / 2))
        const newMatches = algorithm.createPairings(availablePlayers, allTimeMatches, settings, maxMatches)

        if (newMatches.length > 0) {
          const matchesWithTables = assignTablesToMatches(newMatches)
          if (DEBUG)
            console.log(
              `[arena] ${algorithm.name}: New matches:`,
              matchesWithTables.map((m) => `${m.player1.name} vs ${m.player2.name} (Table ${m.tableNumber})`),
            )
          onNewMatches(matchesWithTables)
        }
      }
    }, algorithm.getPollingInterval())

    return () => clearInterval(pairingTimer)
  }, [
    isActive,
    pairedMatches,
    players,
    allTimeMatches,
    tableCount,
    settings,
    tournamentMetadata?.latitude,
    tournamentMetadata?.longitude,
    waitingForFinalResults,
  ])

  // Save active matches whenever pairedMatches changes
  useEffect(() => {
    if (!tournamentId || !isActive) return
    const activeMatches = pairedMatches.filter((m) => !m.result?.completed)
    if (activeMatches.length > 0) {
      onBeforeSave?.()
      saveMatches(tournamentId, activeMatches).catch((err) =>
        console.error("[arena] Failed to save active matches:", err),
      )
    }
  }, [pairedMatches.length, tournamentId, isActive])
}
