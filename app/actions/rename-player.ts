"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface RenamePlayerResponse {
  success: boolean
  error?: string
}

/**
 * Rename a player in a tournament - ORGANIZER ONLY.
 * Enforces per-tournament name uniqueness (case-insensitive).
 */
export async function renamePlayer(
  tournamentId: string,
  playerId: string,
  newName: string,
): Promise<RenamePlayerResponse> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: "Authentication required" }
  }

  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("organizer_id, status")
    .eq("id", tournamentId)
    .single()

  if (tournamentError || !tournament) {
    return { success: false, error: "Tournament not found" }
  }

  if (tournament.organizer_id !== user.id) {
    return { success: false, error: "Only the tournament organizer can rename players" }
  }

  if (tournament.status === "completed") {
    return { success: false, error: "Cannot rename players in a completed tournament" }
  }

  const trimmed = newName.trim()
  if (!trimmed) {
    return { success: false, error: "Name cannot be empty" }
  }

  const { data: existingPlayers, error: fetchError } = await supabase
    .from("players")
    .select("id, name")
    .eq("tournament_id", tournamentId)

  if (fetchError || !existingPlayers) {
    return { success: false, error: "Could not load players" }
  }

  const nameLower = trimmed.toLowerCase()
  const takenByOther = existingPlayers.some(
    (p) => p.id !== playerId && (p.name || "").trim().toLowerCase() === nameLower,
  )
  if (takenByOther) {
    return {
      success: false,
      error: `${trimmed} already exists in this tournament. Use a different name.`,
    }
  }

  const { error: updateError } = await supabase
    .from("players")
    .update({ name: trimmed })
    .eq("id", playerId)
    .eq("tournament_id", tournamentId)

  if (updateError) {
    console.error("[rename-player] update error:", updateError)
    return { success: false, error: "Could not update name" }
  }

  revalidatePath(`/tournament/${tournamentId}`)
  return { success: true }
}
