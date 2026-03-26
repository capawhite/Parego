import type { TournamentSettings } from "@/lib/types"

/** Row shape from DB / loadTournament */
export interface TournamentRowForTables {
  tables_count: number
  settings?: TournamentSettings | Record<string, unknown> | null
  status: "setup" | "active" | "completed"
}

/**
 * Resolve physical table slots from `tables_count` column vs `settings.tableCount`
 * (they can desync if the column was never updated). Active tournaments need ≥1 slot for pairing.
 */
export function effectiveTableCountFromDb(tournament: TournamentRowForTables): number {
  const col = tournament.tables_count || 0
  const s = tournament.settings
  const fromSettings =
    s && typeof s === "object" && typeof (s as TournamentSettings).tableCount === "number"
      ? (s as TournamentSettings).tableCount
      : 0
  const merged = Math.max(col, fromSettings)
  if (tournament.status === "active") return Math.max(1, merged)
  return merged
}

/** Slots available for pairing / table assignment in the arena client. */
export function effectiveTableSlotsForPairing(arenaTableCount: number, settings: TournamentSettings): number {
  return Math.max(1, arenaTableCount || 0, settings.tableCount || 0)
}
