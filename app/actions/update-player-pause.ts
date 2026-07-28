"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient, adminClientMissingReason } from "@/lib/supabase/admin"

export type PlayerPresenceResult = { ok: boolean; error?: string }

async function assertOrganizerOrOwner(tournamentId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient()
  if (!admin) return false
  const { data } = await admin
    .from("tournaments")
    .select("organizer_id, owner_id")
    .eq("id", tournamentId)
    .maybeSingle()
  if (!data) return false
  return data.organizer_id === userId || data.owner_id === userId
}

/** Self or organizer: set paused / marked-for-pause flags via service role. */
export async function updatePlayerPauseState(input: {
  tournamentId: string
  playerId: string
  paused?: boolean
  isPaused?: boolean
}): Promise<PlayerPresenceResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Sign in required" }

  const admin = createAdminClient()
  if (!admin) return { ok: false, error: adminClientMissingReason() }

  const { data: player } = await admin
    .from("players")
    .select("id, user_id")
    .eq("id", input.playerId)
    .eq("tournament_id", input.tournamentId)
    .maybeSingle()

  if (!player) return { ok: false, error: "Player not found" }

  const isSelf = player.user_id === user.id
  const isOrg = await assertOrganizerOrOwner(input.tournamentId, user.id)
  if (!isSelf && !isOrg) return { ok: false, error: "Not allowed" }

  const patch: Record<string, unknown> = {}
  if (typeof input.paused === "boolean") patch.paused = input.paused
  if (typeof input.isPaused === "boolean") patch.is_paused = input.isPaused

  const { error } = await admin.from("players").update(patch).eq("id", input.playerId).eq("tournament_id", input.tournamentId)
  if (error) {
    console.error("[updatePlayerPauseState]", error)
    return { ok: false, error: "Could not update pause state" }
  }
  return { ok: true }
}
