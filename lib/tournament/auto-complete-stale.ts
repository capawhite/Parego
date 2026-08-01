import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient, adminClientMissingReason } from "@/lib/supabase/admin"
import { isTournamentStale, type StaleTournamentRow } from "@/lib/tournament/stale"

export type AutoCompleteStaleSummary = {
  success: boolean
  error?: string
  scanned: number
  completed: number
  ids: string[]
}

/**
 * Force-complete abandoned setup/active tournaments (duration + 24h grace).
 * Safe to run from the pairing cron.
 */
export async function autoCompleteStaleTournamentsImpl(
  adminClient?: SupabaseClient | null,
  nowMs = Date.now(),
): Promise<AutoCompleteStaleSummary> {
  const admin = adminClient ?? createAdminClient()
  if (!admin) {
    return {
      success: false,
      error: adminClientMissingReason(),
      scanned: 0,
      completed: 0,
      ids: [],
    }
  }

  const { data: rows, error } = await admin
    .from("tournaments")
    .select("id, status, start_time, created_at, settings")
    .in("status", ["setup", "active"])
    .limit(500)

  if (error) {
    console.error("[auto-complete-stale] list failed:", error)
    return {
      success: false,
      error: "Failed to list tournaments",
      scanned: 0,
      completed: 0,
      ids: [],
    }
  }

  const candidates = ((rows ?? []) as StaleTournamentRow[]).filter((row) =>
    isTournamentStale(row, nowMs),
  )

  const ids: string[] = []
  for (const row of candidates) {
    const { error: updErr } = await admin
      .from("tournaments")
      .update({ status: "completed", updated_at: new Date(nowMs).toISOString() })
      .eq("id", row.id)
      .in("status", ["setup", "active"])

    if (updErr) {
      console.error("[auto-complete-stale] update failed:", row.id, updErr)
      continue
    }
    ids.push(row.id)
  }

  return {
    success: true,
    scanned: (rows ?? []).length,
    completed: ids.length,
    ids,
  }
}
