"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getSubmissionSide, type ResultType } from "@/lib/result-utils"

interface SubmitResultResponse {
  success: boolean
  error?: string
  match?: any
}

export async function submitMatchResult(
  matchId: string,
  result: ResultType,
  confirmed: boolean,
): Promise<SubmitResultResponse> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    if (process.env.NODE_ENV === "development") console.log("[v0] Authentication failed:", authError)
    return { success: false, error: "You must be logged in to submit results" }
  }

  const { data: match, error: fetchError } = await supabase
    .from("matches")
    .select(
      `
      *,
      player1_data,
      player2_data
    `,
    )
    .eq("id", matchId)
    .single()

  if (fetchError || !match) {
    console.error("[v0] Error fetching match:", fetchError)
    return { success: false, error: "Match not found" }
  }

  const { data: tournament } = await supabase
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

  const side = getSubmissionSide(user.id, match.player1_data, match.player2_data)
  if (!side) {
    if (process.env.NODE_ENV === "development")
      console.log("[v0] User is not a player in this match:", { userId: user.id, match })
    return { success: false, error: "You are not a player in this match" }
  }

  const submissionField = side === "player1" ? "player1_submission" : "player2_submission"
  const timestampField = side === "player1" ? "player1_submission_time" : "player2_submission_time"

  const { error: updateError } = await supabase
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

  const { data: updatedMatch } = await supabase.from("matches").select("*").eq("id", matchId).single()

  // Revalidate the tournament page
  revalidatePath(`/tournament/${match.tournament_id}`)

  return { success: true, match: updatedMatch }
}
