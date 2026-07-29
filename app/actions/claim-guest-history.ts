"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient, adminClientMissingReason } from "@/lib/supabase/admin"

const MAX_CLAIM = 20

export interface ClaimGuestHistoryResult {
  success: boolean
  error?: string
  claimedCount?: number
}

/**
 * Link guest player records to the current user.
 * Requires device_id match (proof this browser created the guest seat).
 * Claims seats from setup/active/completed tournaments via service role.
 */
export async function claimGuestHistoryForDevice(
  playerIds: string[],
  deviceId: string | null | undefined,
): Promise<ClaimGuestHistoryResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: "You must be signed in to claim past play" }
  }

  const ids = Array.isArray(playerIds) ? playerIds.slice(0, MAX_CLAIM) : []
  if (ids.length === 0) {
    return { success: true, claimedCount: 0 }
  }

  const trimmedDevice = typeof deviceId === "string" ? deviceId.trim() : ""
  if (!trimmedDevice) {
    return { success: false, error: "Device id required to claim guest history" }
  }

  const admin = createAdminClient()
  if (!admin) {
    return { success: false, error: adminClientMissingReason() }
  }

  const { data: rows, error: fetchError } = await admin
    .from("players")
    .select("id, tournament_id, user_id, device_id")
    .in("id", ids)
    .is("user_id", null)

  if (fetchError) {
    console.error("[claim-guest-history] fetch error:", fetchError)
    return { success: false, error: "Could not link past play" }
  }

  const candidates = (rows ?? []).filter((r) => r.device_id === trimmedDevice)
  if (candidates.length === 0) {
    return { success: true, claimedCount: 0 }
  }

  const tournamentIds = [...new Set(candidates.map((c) => c.tournament_id))]
  const { data: tournaments } = await admin.from("tournaments").select("id, status").in("id", tournamentIds)
  // Claim seats from live or finished events so "register now" saves the current tournament too.
  const claimableStatuses = new Set(["setup", "active", "completed"])
  const claimableTournamentIds = new Set(
    (tournaments ?? []).filter((t) => claimableStatuses.has(t.status)).map((t) => t.id),
  )

  const claimableIds = candidates.filter((c) => claimableTournamentIds.has(c.tournament_id)).map((c) => c.id)
  if (claimableIds.length === 0) {
    return { success: true, claimedCount: 0 }
  }

  const { data: updated, error: updateError } = await admin
    .from("players")
    .update({ user_id: user.id, is_guest: false })
    .in("id", claimableIds)
    .is("user_id", null)
    .eq("device_id", trimmedDevice)
    .select("id")

  if (updateError) {
    console.error("[claim-guest-history] update error:", updateError)
    return { success: false, error: "Could not link past play" }
  }

  return { success: true, claimedCount: updated?.length ?? 0 }
}
