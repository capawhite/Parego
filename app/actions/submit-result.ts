"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createBrowserClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { getSubmissionSide, parsePlayerData, type ResultType } from "@/lib/result-utils"

interface SubmitResultResponse {
  success: boolean
  error?: string
  match?: any
}

/**
 * Submit a match result. Works for both registered users (via auth) and
 * guests (via playerId). When a playerId is provided and the user is not
 * authenticated, we verify the playerId against the match data and use an
 * admin client to bypass RLS.
 */
export async function submitMatchResult(
  matchId: string,
  result: ResultType,
  confirmed: boolean,
  playerId?: string,
): Promise<SubmitResultResponse> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Need either auth or a playerId
  if (!user && !playerId) {
    return { success: false, error: "You must be logged in or provide a player ID to submit results" }
  }

  // Use admin client to bypass RLS for guests
  const adminClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { data: match, error: fetchError } = await adminClient
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single()

  if (fetchError || !match) {
    console.error("[v0] Error fetching match:", fetchError)
    return { success: false, error: "Match not found" }
  }

  const { data: tournament } = await adminClient
    .from("tournaments")
    .select("status")
    .eq("id", match.tournament_id)
    .single()

  if (!tournament || tournament.status !== "active") {
    return { success: false, error: "Tournament is not active" }
  }

  if (match.completed) {
    return { success: false, error: "Match is already completed" }
  }

  // Determine which side this user/player is on
  let side: "player1" | "player2" | null = null

  if (user) {
    side = getSubmissionSide(user.id, match.player1_data, match.player2_data)
  }

  if (!side && playerId) {
    // Guest path: verify playerId against match player IDs
    if (match.player1_id === playerId) {
      side = "player1"
    } else if (match.player2_id === playerId) {
      side = "player2"
    } else {
      // Also check the serialised player data for embedded id fields
      const p1 = parsePlayerData(match.player1_data)
      const p2 = parsePlayerData(match.player2_data)
      if ((p1 as any)?.id === playerId) side = "player1"
      else if ((p2 as any)?.id === playerId) side = "player2"
    }
  }

  if (!side) {
    return { success: false, error: "You are not a player in this match" }
  }

  const submissionField = side === "player1" ? "player1_submission" : "player2_submission"
  const timestampField = side === "player1" ? "player1_submission_time" : "player2_submission_time"

  const { error: updateError } = await adminClient
    .from("matches")
    .update({
      [submissionField]: confirmed ? result : null,
      [timestampField]: confirmed ? new Date().toISOString() : null,
    })
    .eq("id", matchId)

  if (updateError) {
    console.error("[v0] Error updating match submission:", updateError)
    return { success: false, error: "Failed to save result" }
  }

  const { data: updatedMatch } = await adminClient.from("matches").select("*").eq("id", matchId).single()

  revalidatePath(`/tournament/${match.tournament_id}`)

  return { success: true, match: updatedMatch }
}
