import type { ArenaState, Match, Player, TournamentSettings } from "@/lib/types"
import { getPairingAlgorithm } from "@/lib/pairing"
import { isPlayerAvailableForPairing } from "@/lib/pairing/player-eligibility"
import { effectiveTableSlotsForPairing } from "@/lib/tournament/effective-table-count"
import { assignTablesToMatchesForState } from "@/lib/tournament/merge-matches"

export type PairTickInput = {
  players: Player[]
  pairedMatches: Match[]
  allTimeMatches: Match[]
  settings: TournamentSettings
  tableCount: number
  hasVenue: boolean
  /** Active incomplete matches already in DB (for cross-tab dedup). */
  dbActivePlayerIds?: Set<string>
}

export type PairTickResult = {
  wouldPair: boolean
  newMatches: Match[]
}

/**
 * One pairing algorithm tick: eligibility → shouldPair → createPairings → tables → dedup.
 * Pure aside from algorithm RNG; used by server pair API (and tests).
 */
export function runPairTick(input: PairTickInput): PairTickResult {
  const algorithmId = input.settings.pairingAlgorithm || "all-vs-all"
  if (algorithmId === "fide-swiss") {
    return { wouldPair: false, newMatches: [] }
  }

  const algorithm = getPairingAlgorithm(algorithmId)
  const activePairingMatches = input.pairedMatches.filter((m) => !m.result?.completed)
  const availablePlayers = input.players.filter((p) =>
    isPlayerAvailableForPairing(p, activePairingMatches, input.hasVenue),
  )

  const tableSlots = effectiveTableSlotsForPairing(input.tableCount, input.settings)
  const occupiedTables = input.pairedMatches
    .filter((m) => !m.result?.completed && m.tableNumber)
    .map((m) => m.tableNumber!)
  const availableTables = tableSlots - occupiedTables.length

  const byId = new Map<string, Match>()
  for (const m of input.allTimeMatches) byId.set(m.id, m)
  for (const m of input.pairedMatches) {
    if (m.result?.completed) byId.set(m.id, m)
  }
  const matchesForPairing = [...byId.values()]

  const wouldPair = algorithm.shouldPair(
    availablePlayers,
    activePairingMatches,
    input.players.length,
    availableTables,
    input.settings,
    matchesForPairing,
  )

  if (!wouldPair) {
    return { wouldPair: false, newMatches: [] }
  }

  const maxMatches = Math.min(availableTables, Math.floor(availablePlayers.length / 2))
  const newMatches = algorithm.createPairings(
    availablePlayers,
    matchesForPairing,
    input.settings,
    maxMatches,
    input.players.length,
  )

  if (newMatches.length === 0) {
    return { wouldPair: true, newMatches: [] }
  }

  const stateSlice: ArenaState = {
    players: input.players,
    rounds: [],
    currentRound: null,
    pairedMatches: input.pairedMatches,
    tournamentStartTime: null,
    tournamentDuration: 0,
    isActive: true,
    allTimeMatches: input.allTimeMatches,
    tableCount: input.tableCount,
    settings: input.settings,
    status: "active",
  }

  let withTables = assignTablesToMatchesForState(newMatches, stateSlice)

  if (input.dbActivePlayerIds && input.dbActivePlayerIds.size > 0) {
    withTables = withTables.filter(
      (m) => !input.dbActivePlayerIds!.has(m.player1.id) && !input.dbActivePlayerIds!.has(m.player2.id),
    )
  }

  return { wouldPair: true, newMatches: withTables }
}
