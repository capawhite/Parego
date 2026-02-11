"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

interface ManagePlayerResponse {
  success: boolean
  error?: string
}

/**
 * Server action to remove a player - ORGANIZER ONLY
 */
export async function removePlayer(tournamentId: string, playerId: string): Promise<ManagePlayerResponse> {
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
    return { success: false, error: "Only the tournament organizer can remove players" }
  }

  // 3. Update or delete player based on tournament status
  if (tournament.status === "active") {
    // Mark player as paused/removed during active tournament
    const { error: updateError } = await supabase
      .from("players")
      .update({
        paused: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", playerId)
      .eq("tournament_id", tournamentId)

    if (updateError) {
      console.error("[v0] Error pausing player:", updateError)
      return { success: false, error: "Failed to remove player" }
    }
  } else {
    // Actually delete player during setup
    const { error: deleteError } = await supabase
      .from("players")
      .delete()
      .eq("id", playerId)
      .eq("tournament_id", tournamentId)

    if (deleteError) {
      console.error("[v0] Error deleting player:", deleteError)
      return { success: false, error: "Failed to remove player" }
    }
  }

  // 4. Revalidate the tournament page
  revalidatePath(`/tournament/${tournamentId}`)

  return { success: true }
}

/**
 * Server action to add a player - ORGANIZER ONLY
 */
export async function addPlayer(
  tournamentId: string,
  playerData: {
    id: string
    name: string
    userId?: string
    isGuest: boolean
  },
): Promise<ManagePlayerResponse> {
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
    return { success: false, error: "Only the tournament organizer can add players" }
  }

  if (tournament.status === "completed") {
    return { success: false, error: "Cannot add players to a completed tournament" }
  }

  // 3. Check per-tournament name uniqueness (case-insensitive)
  const { data: existingPlayers, error: fetchError } = await supabase
    .from("players")
    .select("name")
    .eq("tournament_id", tournamentId)

  if (!fetchError && existingPlayers) {
    const nameLower = playerData.name.trim().toLowerCase()
    if (nameLower) {
      const taken = existingPlayers.some((p) => (p.name || "").trim().toLowerCase() === nameLower)
      if (taken) {
        return {
          success: false,
          error: `${playerData.name} already exists in this tournament. Use a different name, e.g. ${playerData.name} R. or ${playerData.name} (Madrid).`,
        }
      }
    }
  }

  // 4. Insert the player
  const { error: insertError } = await supabase
    .from("players")
    .insert({
    id: playerData.id,
    tournament_id: tournamentId,
    name: playerData.name,
    user_id: playerData.userId || null,
    is_guest: playerData.isGuest,
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    games_played: 0,
    white_count: 0,
    black_count: 0,
    current_streak: 0,
    on_streak: false,
    paused: false,
    game_history: [],
    opponents: [],
    results: [],
    colors: [],
    points_earned: [],
    table_numbers: [],
    })

  if (insertError) {
    console.error("[v0] Error adding player:", insertError)
    return { success: false, error: "Failed to add player" }
  }

  // 5. Revalidate the tournament page
  revalidatePath(`/tournament/${tournamentId}`)

  return { success: true }
}
