import type { ArenaState, Match } from "@/lib/types"
import { effectiveTableSlotsForPairing } from "@/lib/tournament/effective-table-count"

/** Merge paired and completed matches for saving; completed version wins on duplicate ids */
export function mergeMatchesForSave(paired: Match[], allTime: Match[]): Match[] {
  const map = new Map<string, Match>()
  paired.forEach((m) => map.set(m.id, m))
  allTime.forEach((m) => map.set(m.id, m))
  return Array.from(map.values())
}

/** Assign free table numbers to newly created matches (highest combined score first). */
export function assignTablesToMatchesForState(matches: Match[], state: ArenaState): Match[] {
  const sortedMatches = [...matches].sort((a, b) => {
    const scoreA = a.player1.score + a.player2.score
    const scoreB = b.player1.score + b.player2.score
    return scoreB - scoreA
  })
  const slots = effectiveTableSlotsForPairing(state.tableCount, state.settings)
  const occupiedTables = state.pairedMatches
    .filter((m) => !m.result?.completed && m.tableNumber)
    .map((m) => m.tableNumber!)
  const availableTables = Array.from({ length: slots }, (_, i) => i + 1).filter(
    (t) => !occupiedTables.includes(t),
  )
  return sortedMatches.map((match, index) => ({
    ...match,
    tableNumber: availableTables[index],
  }))
}
