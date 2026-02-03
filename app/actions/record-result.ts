"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

interface RecordResultResponse {
  success: boolean
  error?: string
}

/**
 * Server action to record a match result - ORGANIZER ONLY
 * Players should use submitMatchResult instead
 */
export async function recordMatchResult(
  tournamentId: string,
  matchId: string,
  winnerId: string | undefined,
  isDraw: boolean,
): Promise<RecordResultResponse> {
  const supabase = await createClient()

  // 1. Authenticate user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: "Authentication required" }
  }

  // 2. Verify user is the organizer of this tournament
  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("organizer_id, status")
    .eq("id", tournamentId)
    .single()

  if (tournamentError || !tournament) {
    return { success: false, error: "Tournament not found" }
  }

  if (tournament.organizer_id !== user.id) {
    console.log("[v0] Permission denied: User is not the organizer", {
      userId: user.id,
      organizerId: tournament.organizer_id,
    })
    return { success: false, error: "Only the tournament organizer can record results" }
  }

  if (tournament.status !== "active") {
    return { success: false, error: "Tournament is not active" }
  }

  // 3. Fetch the match to validate it exists and get player data
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("*, player1_data, player2_data")
    .eq("id", matchId)
    .eq("tournament_id", tournamentId)
    .single()

  if (matchError || !match) {
    return { success: false, error: "Match not found" }
  }

  if (match.completed) {
    return { success: false, error: "Match is already completed" }
  }

  // 4. Update the match with the result
  // Store result in same JSON structure as saveMatches/loadMatches expect
  const completedAt = Date.now()
  const resultJson = JSON.stringify({
    winnerId: isDraw ? undefined : winnerId,
    isDraw,
    completed: true,
    completedAt,
  })

  const { error: updateError } = await supabase
    .from("matches")
    .update({
      completed: true,
      winner_id: isDraw ? null : winnerId,
      result: resultJson,
      completed_at: new Date(completedAt).toISOString(),
    })
    .eq("id", matchId)

  if (updateError) {
    console.error("[v0] Error updating match:", updateError)
    return { success: false, error: "Failed to record result" }
  }

  // 5. Revalidate the tournament page
  revalidatePath(`/tournament/${tournamentId}`)

  return { success: true }
}
