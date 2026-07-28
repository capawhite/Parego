import type { SupabaseClient } from "@supabase/supabase-js"
import type { TournamentSettings } from "@/lib/types"
import { DEFAULT_SETTINGS } from "@/lib/types"
import { parseTournamentSettings } from "@/lib/tournament-settings"
import { mapDbPlayerRow, mapDbMatchRow, matchesToDbRows } from "@/lib/database/row-mappers"
import { runPairTick } from "@/lib/pairing/run-pair-tick"
import { createAdminClient, adminClientMissingReason } from "@/lib/supabase/admin"
import {
  claimPairingLease,
  pairingLeaseHolderId,
  releasePairingLease,
} from "@/lib/pairing/pairing-lease"

export type PairTournamentResult = {
  success: boolean
  error?: string
  createdCount?: number
  matchIds?: string[]
  pairingHeartbeatAt?: string
  /** True when another worker held the pairing lease — not an error. */
  skippedDueToLease?: boolean
}

/**
 * Pairing tick for one tournament.
 * - organizer mode: requires organizerUserId to match organizer/owner
 * - system mode: used by authenticated cron (no user id)
 */
export async function pairTournamentImpl(
  tournamentId: string,
  organizerUserId: string | null,
  adminClient?: SupabaseClient | null,
  options?: { mode?: "organizer" | "system" },
): Promise<PairTournamentResult> {
  const mode = options?.mode ?? "organizer"
  const admin = adminClient ?? createAdminClient()
  if (!admin) {
    return { success: false, error: adminClientMissingReason() }
  }

  const { data: tournament, error: tErr } = await admin
    .from("tournaments")
    .select("*")
    .eq("id", tournamentId)
    .single()

  if (tErr || !tournament) {
    return { success: false, error: "Tournament not found" }
  }

  if (mode === "organizer") {
    if (!organizerUserId) {
      return { success: false, error: "Only the organizer can create pairings" }
    }
    if (tournament.organizer_id !== organizerUserId && tournament.owner_id !== organizerUserId) {
      return { success: false, error: "Only the organizer can create pairings" }
    }
  }

  if (tournament.status !== "active") {
    return { success: false, error: "Tournament is not active" }
  }

  const settings: TournamentSettings = {
    ...DEFAULT_SETTINGS,
    ...parseTournamentSettings(tournament),
  }

  if (settings.pairingAlgorithm === "fide-swiss") {
    return { success: false, error: "Swiss pairings are created from the Swiss console" }
  }

  const holder = pairingLeaseHolderId(mode, organizerUserId)
  const claimed = await claimPairingLease(admin, tournamentId, holder)
  if (!claimed) {
    return { success: true, createdCount: 0, matchIds: [], skippedDueToLease: true }
  }

  try {
    // Re-read field after lease so we don't pair on a stale snapshot.
    const [{ data: playerRows }, { data: matchRows }] = await Promise.all([
      admin.from("players").select("*").eq("tournament_id", tournamentId),
      admin.from("matches").select("*").eq("tournament_id", tournamentId).order("created_at", { ascending: true }),
    ])

    const players = (playerRows ?? []).map(mapDbPlayerRow)
    const allMatches = (matchRows ?? []).map(mapDbMatchRow)
    const pairedMatches = allMatches.filter((m) => !m.result?.completed)
    const allTimeMatches = allMatches.filter((m) => !!m.result?.completed)

    const dbActivePlayerIds = new Set(
      pairedMatches.flatMap((m) => [m.player1.id, m.player2.id]),
    )

    const hasVenue = tournament.latitude != null && tournament.longitude != null
    const tableCount =
      typeof tournament.table_count === "number"
        ? tournament.table_count
        : typeof settings.tableCount === "number"
          ? settings.tableCount
          : 0

    const tick = runPairTick({
      players,
      pairedMatches,
      allTimeMatches,
      settings,
      tableCount,
      hasVenue,
      dbActivePlayerIds,
    })

    const heartbeatAt = new Date().toISOString()

    // Dedicated column — avoids settings JSON churn that used to trigger client autosave.
    await admin
      .from("tournaments")
      .update({ pairing_heartbeat_at: heartbeatAt })
      .eq("id", tournamentId)

    if (tick.newMatches.length === 0) {
      return {
        success: true,
        createdCount: 0,
        matchIds: [],
        pairingHeartbeatAt: heartbeatAt,
      }
    }

    const { error: upsertErr } = await admin
      .from("matches")
      .upsert(matchesToDbRows(tournamentId, tick.newMatches))

    if (upsertErr) {
      console.error("[pair-tournament] upsert failed:", upsertErr)
      const { captureException } = await import("@/lib/sentry")
      captureException(upsertErr, { tournamentId, action: "pair-upsert" })
      return { success: false, error: "Failed to save pairings" }
    }

    return {
      success: true,
      createdCount: tick.newMatches.length,
      matchIds: tick.newMatches.map((m) => m.id),
      pairingHeartbeatAt: heartbeatAt,
    }
  } finally {
    await releasePairingLease(admin, tournamentId, holder)
  }
}

export type PairActiveSummary = {
  success: boolean
  error?: string
  scanned: number
  paired: number
  createdMatches: number
  skippedLease: number
  results: { tournamentId: string; createdCount: number; error?: string; skippedDueToLease?: boolean }[]
}

/**
 * System tick across all active non-Swiss tournaments.
 */
export async function pairActiveTournamentsImpl(
  adminClient?: SupabaseClient | null,
): Promise<PairActiveSummary> {
  const admin = adminClient ?? createAdminClient()
  if (!admin) {
    return {
      success: false,
      error: adminClientMissingReason(),
      scanned: 0,
      paired: 0,
      createdMatches: 0,
      skippedLease: 0,
      results: [],
    }
  }

  const { data: rows, error } = await admin
    .from("tournaments")
    .select("id, settings, status")
    .eq("status", "active")

  if (error) {
    console.error("[pair-active] list failed:", error)
    const { captureException } = await import("@/lib/sentry")
    captureException(error, { action: "pair-active-list" })
    return {
      success: false,
      error: "Failed to list active tournaments",
      scanned: 0,
      paired: 0,
      createdMatches: 0,
      skippedLease: 0,
      results: [],
    }
  }

  const arenaIds = (rows ?? []).filter((row) => {
    const settings = parseTournamentSettings(row)
    return settings.pairingAlgorithm !== "fide-swiss"
  })

  const results: PairActiveSummary["results"] = []
  let createdMatches = 0
  let paired = 0
  let skippedLease = 0

  for (const row of arenaIds) {
    const out = await pairTournamentImpl(row.id, null, admin, { mode: "system" })
    if (out.skippedDueToLease) {
      skippedLease += 1
      results.push({ tournamentId: row.id, createdCount: 0, skippedDueToLease: true })
    } else if (out.success) {
      paired += 1
      createdMatches += out.createdCount ?? 0
      results.push({ tournamentId: row.id, createdCount: out.createdCount ?? 0 })
    } else {
      results.push({ tournamentId: row.id, createdCount: 0, error: out.error })
    }
  }

  return {
    success: true,
    scanned: arenaIds.length,
    paired,
    createdMatches,
    skippedLease,
    results,
  }
}
