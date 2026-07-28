import { isPlayerAvailableForPairing } from "@/lib/pairing/player-eligibility"
import { effectiveTableSlotsForPairing } from "@/lib/tournament/effective-table-count"
import type { ArenaState, Match, Player } from "@/lib/types"

export type PairingInputs = {
  activePairingMatches: Match[]
  availablePlayers: Player[]
  availableTables: number
  matchesForPairing: Match[]
}

/** Snapshot used by organizer pairing-debug / reduce-wait actions. */
export function collectPairingInputs(
  state: ArenaState,
  hasVenue: boolean,
): PairingInputs {
  const activePairingMatches = state.pairedMatches.filter((m) => !m.result?.completed)
  const availablePlayers = state.players.filter((p) =>
    isPlayerAvailableForPairing(p, activePairingMatches, hasVenue),
  )
  const tableSlots = effectiveTableSlotsForPairing(state.tableCount, state.settings)
  const occupiedTables = state.pairedMatches
    .filter((m) => !m.result?.completed && m.tableNumber)
    .map((m) => m.tableNumber!)
  const availableTables = tableSlots - occupiedTables.length
  const byId = new Map<string, Match>()
  for (const m of state.allTimeMatches) byId.set(m.id, m)
  for (const m of state.pairedMatches) {
    if (m.result?.completed) byId.set(m.id, m)
  }
  return {
    activePairingMatches,
    availablePlayers,
    availableTables,
    matchesForPairing: [...byId.values()],
  }
}
