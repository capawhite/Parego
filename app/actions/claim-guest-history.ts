"use server"

import { createClient } from "@/lib/supabase/server"

const MAX_CLAIM = 20

export interface ClaimGuestHistoryResult {
  success: boolean
  error?: string
  claimedCount?: number
}

/**
 * Link past guest player records to the current user.
 * Call after signup/sign-in so the user can reclaim their guest history.
 * Only updates rows where user_id is null (guest records); max MAX_CLAIM ids per call.
 */
export async function claimGuestHistory(playerIds: string[]): Promise<ClaimGuestHistoryResult> {
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

  const { data: updated, error: updateError } = await supabase
    .from("players")
    .update({ user_id: user.id })
    .in("id", ids)
    .is("user_id", null)
    .select("id")

  if (updateError) {
    console.error("[claim-guest-history] update error:", updateError)
    return { success: false, error: "Could not link past play" }
  }

  return { success: true, claimedCount: updated?.length ?? 0 }
}
