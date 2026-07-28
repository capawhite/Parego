"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { parseTournamentSettings } from "@/lib/tournament-settings"
import {
  isSwissAlgorithm,
  MIN_SWISS_PLAYERS,
  maxSwissRoundsForPlayerCount,
  validateSwissTournamentField,
} from "@/lib/pairing/swiss"

interface StartTournamentResponse {
  success: boolean
  error?: string
}

/**
 * Server action to start a tournament - ORGANIZER ONLY
 */
export async function startTournament(tournamentId: string): Promise<StartTournamentResponse> {
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
    .select("organizer_id, owner_id, status, settings")
    .eq("id", tournamentId)
    .single()

  if (tournamentError || !tournament) {
    return { success: false, error: "Tournament not found" }
  }

  if (tournament.organizer_id !== user.id && tournament.owner_id !== user.id) {
    return { success: false, error: "Only the tournament organizer can start the tournament" }
  }

  if (tournament.status === "completed") {
    return { success: false, error: "Tournament has already been completed" }
  }

  if (tournament.status === "active") {
    return { success: false, error: "Tournament is already active" }
  }

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("paused", false)

  if (playersError) {
    return { success: false, error: "Failed to check players" }
  }

  const playerCount = players?.length ?? 0
  const settings = parseTournamentSettings(tournament)

  if (isSwissAlgorithm(settings.pairingAlgorithm)) {
    const check = validateSwissTournamentField(settings, playerCount)
    if (!check.valid) {
      const maxR = maxSwissRoundsForPlayerCount(playerCount)
      if (playerCount < MIN_SWISS_PLAYERS) {
        return {
          success: false,
          error: `Swiss needs at least ${MIN_SWISS_PLAYERS} players (you have ${playerCount})`,
        }
      }
      return {
        success: false,
        error:
          check.errors[0] ??
          `With ${playerCount} players, use at most ${maxR} Swiss rounds (players − 1)`,
      }
    }
  } else if (playerCount < 2) {
    return { success: false, error: "Need at least 2 players to start" }
  }

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

  revalidatePath(`/tournament/${tournamentId}`)

  return { success: true }
}
