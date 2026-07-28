"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient, adminClientMissingReason } from "@/lib/supabase/admin"

export type RemovePlayerResult = { ok: boolean; error?: string }

/**
 * Remove a player (organizer) or leave a tournament (self) via service role.
 * Active tournaments mark the player removed; otherwise the row is deleted.
 */
export async function removePlayerAction(input: {
  tournamentId: string
  playerId: string
}): Promise<RemovePlayerResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Sign in required" }

  const admin = createAdminClient()
  if (!admin) return { ok: false, error: adminClientMissingReason() }

  const { data: tournament } = await admin
    .from("tournaments")
    .select("organizer_id, owner_id, status")
    .eq("id", input.tournamentId)
    .maybeSingle()
  if (!tournament) return { ok: false, error: "Tournament not found" }

  const { data: player } = await admin
    .from("players")
    .select("id, user_id")
    .eq("id", input.playerId)
    .eq("tournament_id", input.tournamentId)
    .maybeSingle()
  if (!player) return { ok: false, error: "Player not found" }

  const isOrganizer = tournament.organizer_id === user.id || tournament.owner_id === user.id
  const isSelf = player.user_id === user.id
  if (!isOrganizer && !isSelf) return { ok: false, error: "Not allowed" }

  if (tournament.status === "active") {
    const { error } = await admin
      .from("players")
      .update({ paused: true, is_removed: true })
      .eq("id", input.playerId)
      .eq("tournament_id", input.tournamentId)
    if (error) {
      console.error("[remove-player] update failed:", error)
      return { ok: false, error: "Could not remove player" }
    }
  } else {
    const { error } = await admin
      .from("players")
      .delete()
      .eq("id", input.playerId)
      .eq("tournament_id", input.tournamentId)
    if (error) {
      console.error("[remove-player] delete failed:", error)
      return { ok: false, error: "Could not remove player" }
    }
  }

  return { ok: true }
}
