import type { ArenaState, Match, Player, TournamentSettings } from "@/lib/types"
import { getPairingAlgorithm } from "@/lib/pairing"
import { isPlayerAvailableForPairing } from "@/lib/pairing/player-eligibility"
import { effectiveTableSlotsForPairing } from "@/lib/tournament/effective-table-count"
import { minIdlePlayersBeforePairing } from "@/lib/pairing/idle-threshold"
import {
  arenaPairingEligibleAtMs,
  filterArenaT1EligiblePlayers,
  isArenaT1Eligible,
  tpMsFromSettings,
} from "@/lib/pairing/arena-t1"

export type PairingInsightPlayerStatus =
  | "in_game"
  | "ready"
  | "t1_wait"
  | "paused"
  | "marked"
  | "not_checked_in"
  | "left"

export interface PairingInsightPlayer {
  id: string
  name: string
  status: PairingInsightPlayerStatus
  /** Arena only; wall-clock ms when T1 passes (null if not applicable) */
  eligibleAtMs: number | null
  remainingMs: number | null
}

export type PairingInsightBlockerId =
  | "small_field"
  | "min_idle"
  | "no_tables"
  | "not_active"
  | "waiting_final_results"

export interface PairingInsightBlocker {
  id: PairingInsightBlockerId
  need?: number
  have?: number
}

export interface ArenaPairingInsightsInput {
  state: ArenaState
  nowMs: number
  /** When lat/lng set, check-in is required for pairing */
  tournamentMetadata: { latitude?: number | null; longitude?: number | null } | null
  isActive: boolean
  waitingForFinalResults: boolean
}

export interface ArenaPairingInsights {
  algorithmId: string
  usesT1: boolean
  tpMs: number
  totalPlayers: number
  activeMatchesCount: number
  tableSlots: number
  availableTables: number
  smallFieldBlocked: boolean
  baseMinIdle: number
  effectiveMinIdle: number
  idleForPairingCount: number
  t1EligibleIdleCount: number
  wouldPair: boolean
  blockers: PairingInsightBlocker[]
  players: PairingInsightPlayer[]
}

function buildMatchesForPairing(pairedMatches: Match[], allTimeMatches: Match[]): Match[] {
  const byId = new Map<string, Match>()
  for (const m of allTimeMatches) byId.set(m.id, m)
  for (const m of pairedMatches) {
    if (m.result?.completed) byId.set(m.id, m)
  }
  return [...byId.values()]
}

function remainingMsForEligibleAt(eligibleAtMs: number, nowMs: number): number {
  if (eligibleAtMs <= 0) return 0
  return Math.max(0, eligibleAtMs - nowMs)
}

/**
 * Snapshot of queue / gates for organizer “why is pairing waiting?” UI.
 * Mirrors [`components/arena-panel.tsx`] pairing tick inputs.
 */
export function computeArenaPairingInsights(input: ArenaPairingInsightsInput): ArenaPairingInsights {
  const { state, nowMs, tournamentMetadata, isActive, waitingForFinalResults } = input
  const settings: TournamentSettings = state.settings
  const algorithmId = settings.pairingAlgorithm || "all-vs-all"
  const algorithm = getPairingAlgorithm(algorithmId)
  const usesT1 = algorithmId === "balanced-strength"

  const activePairingMatches = state.pairedMatches.filter((m) => !m.result?.completed)
  const activeMatchesCount = activePairingMatches.length

  const hasVenue =
    tournamentMetadata?.latitude != null &&
    tournamentMetadata?.longitude != null &&
    Number.isFinite(tournamentMetadata.latitude) &&
    Number.isFinite(tournamentMetadata.longitude)

  const inActiveGame = (p: Player) =>
    activePairingMatches.some((m) => m.player1.id === p.id || m.player2.id === p.id)

  const availablePlayers = state.players.filter((p) =>
    isPlayerAvailableForPairing(p, activePairingMatches, hasVenue),
  )

  const tableSlots = effectiveTableSlotsForPairing(state.tableCount, settings)
  const occupiedTables = state.pairedMatches
    .filter((m) => !m.result?.completed && m.tableNumber)
    .map((m) => m.tableNumber!)
  const availableTables = tableSlots - occupiedTables.length

  const matchesForPairing = buildMatchesForPairing(state.pairedMatches, state.allTimeMatches)

  const totalPlayers = state.players.length
  const SMALL_FIELD_MAX = 4
  const smallFieldBlocked = totalPlayers <= SMALL_FIELD_MAX && activeMatchesCount > 0

  const baseMinIdle = minIdlePlayersBeforePairing(totalPlayers, settings)

  let effectiveMinIdle: number
  let t1EligibleIdleCount: number

  if (usesT1) {
    const eligible = filterArenaT1EligiblePlayers(availablePlayers, matchesForPairing, settings, nowMs)
    t1EligibleIdleCount = eligible.length
    effectiveMinIdle =
      activeMatchesCount > 0
        ? Math.min(baseMinIdle, Math.max(2, availablePlayers.length))
        : baseMinIdle
  } else {
    t1EligibleIdleCount = availablePlayers.length
    effectiveMinIdle = baseMinIdle
  }

  const idleForPairingCount = availablePlayers.length

  const wouldPair =
    isActive &&
    !waitingForFinalResults &&
    algorithm.shouldPair(
      availablePlayers,
      activePairingMatches,
      state.players.length,
      availableTables,
      settings,
      matchesForPairing,
    )

  const blockers: PairingInsightBlocker[] = []
  if (!isActive) blockers.push({ id: "not_active" })
  if (waitingForFinalResults) blockers.push({ id: "waiting_final_results" })
  if (isActive && !waitingForFinalResults) {
    if (smallFieldBlocked) blockers.push({ id: "small_field" })
    if (availableTables <= 0) blockers.push({ id: "no_tables" })
    if (usesT1) {
      if (t1EligibleIdleCount < effectiveMinIdle) {
        blockers.push({
          id: "min_idle",
          need: effectiveMinIdle,
          have: t1EligibleIdleCount,
        })
      }
    } else {
      if (idleForPairingCount < effectiveMinIdle) {
        blockers.push({
          id: "min_idle",
          need: effectiveMinIdle,
          have: idleForPairingCount,
        })
      }
    }
  }

  const tpMs = tpMsFromSettings(settings)

  const players: PairingInsightPlayer[] = state.players.map((p) => {
    if (p.hasLeft) {
      return {
        id: p.id,
        name: p.name,
        status: "left" as const,
        eligibleAtMs: null,
        remainingMs: null,
      }
    }
    if (inActiveGame(p)) {
      return {
        id: p.id,
        name: p.name,
        status: "in_game" as const,
        eligibleAtMs: null,
        remainingMs: null,
      }
    }
    if (p.paused) {
      return {
        id: p.id,
        name: p.name,
        status: "paused" as const,
        eligibleAtMs: null,
        remainingMs: null,
      }
    }
    if (p.markedForRemoval || p.markedForPause) {
      return {
        id: p.id,
        name: p.name,
        status: "marked" as const,
        eligibleAtMs: null,
        remainingMs: null,
      }
    }
    if (hasVenue && p.checkedInAt == null) {
      return {
        id: p.id,
        name: p.name,
        status: "not_checked_in" as const,
        eligibleAtMs: null,
        remainingMs: null,
      }
    }

    if (usesT1) {
      const eligibleAtMs = arenaPairingEligibleAtMs(p, matchesForPairing, settings)
      const t1Ok = isArenaT1Eligible(p, matchesForPairing, settings, nowMs)
      if (t1Ok) {
        return {
          id: p.id,
          name: p.name,
          status: "ready" as const,
          eligibleAtMs,
          remainingMs: 0,
        }
      }
      return {
        id: p.id,
        name: p.name,
        status: "t1_wait" as const,
        eligibleAtMs,
        remainingMs: remainingMsForEligibleAt(eligibleAtMs, nowMs),
      }
    }

    return {
      id: p.id,
      name: p.name,
      status: "ready" as const,
      eligibleAtMs: null,
      remainingMs: null,
    }
  })

  const statusOrder: Record<PairingInsightPlayerStatus, number> = {
    in_game: 0,
    t1_wait: 1,
    ready: 2,
    not_checked_in: 3,
    paused: 4,
    marked: 5,
    left: 6,
  }
  players.sort((a, b) => {
    const oa = statusOrder[a.status]
    const ob = statusOrder[b.status]
    if (oa !== ob) return oa - ob
    if (a.remainingMs != null && b.remainingMs != null && a.remainingMs !== b.remainingMs) {
      return a.remainingMs - b.remainingMs
    }
    return a.name.localeCompare(b.name)
  })

  return {
    algorithmId,
    usesT1,
    tpMs,
    totalPlayers,
    activeMatchesCount,
    tableSlots,
    availableTables,
    smallFieldBlocked,
    baseMinIdle,
    effectiveMinIdle,
    idleForPairingCount,
    t1EligibleIdleCount,
    wouldPair,
    blockers,
    players,
  }
}
