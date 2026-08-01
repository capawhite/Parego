import type { TournamentSettings } from "@/lib/types"
import { isSwissAlgorithm } from "@/lib/pairing/swiss"

/** Default planned length when the organizer did not persist a duration (arena). */
export const DEFAULT_ARENA_DURATION_MINUTES = 60

/** Default planned length for Swiss when none was persisted (club evenings can run long). */
export const DEFAULT_SWISS_DURATION_MINUTES = 12 * 60

/**
 * After the planned end, wait this long before force-completing.
 * Example: 1h arena → auto-complete 25h after start.
 */
export const STALE_GRACE_AFTER_END_MS = 24 * 60 * 60 * 1000

export type StaleTournamentRow = {
  id: string
  status: "setup" | "active" | "completed" | string
  start_time?: string | null
  created_at?: string | null
  settings?: unknown
}

function durationMinutesFromSettings(settings: unknown): number {
  const s = settings as TournamentSettings | Record<string, unknown> | null | undefined
  const raw =
    s && typeof s === "object" && typeof (s as TournamentSettings).arenaDurationMinutes === "number"
      ? (s as TournamentSettings).arenaDurationMinutes
      : undefined
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 1) {
    return Math.min(24 * 60, Math.floor(raw))
  }
  const algo =
    s && typeof s === "object" && typeof (s as TournamentSettings).pairingAlgorithm === "string"
      ? (s as TournamentSettings).pairingAlgorithm
      : undefined
  if (algo && isSwissAlgorithm(algo)) return DEFAULT_SWISS_DURATION_MINUTES
  return DEFAULT_ARENA_DURATION_MINUTES
}

function parseMs(iso?: string | null): number | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? null : ms
}

/**
 * Absolute timestamp after which the tournament should be force-completed.
 * Returns null when the row is already completed or we cannot judge.
 */
export function tournamentStaleDeadlineMs(row: StaleTournamentRow): number | null {
  if (row.status === "completed") return null

  const durationMs = durationMinutesFromSettings(row.settings) * 60 * 1000

  if (row.status === "active") {
    const started = parseMs(row.start_time) ?? parseMs(row.created_at)
    if (started == null) return null
    return started + durationMs + STALE_GRACE_AFTER_END_MS
  }

  // Abandoned setup: scheduled start came and went, then a full day passed.
  if (row.status === "setup") {
    const scheduled = parseMs(row.start_time)
    if (scheduled == null) return null
    return scheduled + STALE_GRACE_AFTER_END_MS
  }

  return null
}

export function isTournamentStale(row: StaleTournamentRow, nowMs = Date.now()): boolean {
  const deadline = tournamentStaleDeadlineMs(row)
  return deadline != null && nowMs >= deadline
}
