"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

interface StartTournamentResponse {
  success: boolean
  error?: string
}

/**
 * Server action to start a tournament - ORGANIZER ONLY
 */
export async function startTournament(tournamentId: string): Promise<StartTournamentResponse> {
  const supabase = await createClient()

  // 1. Authenticate user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: "Authentication required" }
  }

  // 2. Verify user is the organizer
  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("organizer_id, status")
    .eq("id", tournamentId)
    .single()

  if (tournamentError || !tournament) {
    return { success: false, error: "Tournament not found" }
  }

  if (tournament.organizer_id !== user.id) {
    return { success: false, error: "Only the tournament organizer can start the tournament" }
  }

  if (tournament.status === "completed") {
    return { success: false, error: "Tournament has already been completed" }
  }

  if (tournament.status === "active") {
    return { success: false, error: "Tournament is already active" }
  }

  // 3. Check if there are enough players
  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("paused", false)

  if (playersError) {
    return { success: false, error: "Failed to check players" }
  }

  if (!players || players.length < 2) {
    return { success: false, error: "Need at least 2 players to start" }
  }

  // 4. Update tournament status to active
  const { error: updateError } = await supabase
    .from("tournaments")
    .update({
      status: "active",
      start_time: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", tournamentId)

  if (updateError) {
    console.error("[v0] Error starting tournament:", updateError)
    return { success: false, error: "Failed to start tournament" }
  }

  // 5. Revalidate the tournament page
  revalidatePath(`/tournament/${tournamentId}`)

  return { success: true }
}
