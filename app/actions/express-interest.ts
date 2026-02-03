"use server"

import { createClient } from "@/lib/supabase/server"

export interface ToggleInterestResult {
  ok: boolean
  count: number
  interested: boolean
  error?: string
}

/**
 * Toggle express-interest for the current user on a tournament.
 * Requires sign-in. Returns new count and whether user is now interested.
 */
export async function toggleInterest(tournamentId: string): Promise<ToggleInterestResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, count: 0, interested: false, error: "Sign in to express interest" }
  }

  const { data: existing } = await supabase
    .from("tournament_interest")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("user_id", user.id)
    .maybeSingle()

  const currentlyInterested = !!existing

  if (currentlyInterested) {
    const { error: delError } = await supabase
      .from("tournament_interest")
      .delete()
      .eq("tournament_id", tournamentId)
      .eq("user_id", user.id)
    if (delError) {
      console.error("[express-interest] remove error:", delError)
      return { ok: false, count: 0, interested: true, error: delError.message }
    }
  } else {
    const { error: insError } = await supabase
      .from("tournament_interest")
      .insert({ tournament_id: tournamentId, user_id: user.id })
    if (insError) {
      if (insError.code === "23505") {
        // already exists
        const { count } = await supabase
          .from("tournament_interest")
          .select("*", { count: "exact", head: true })
          .eq("tournament_id", tournamentId)
        return { ok: true, count: count ?? 0, interested: true }
      }
      console.error("[express-interest] add error:", insError)
      return { ok: false, count: 0, interested: false, error: insError.message }
    }
  }

  const { count, error: countError } = await supabase
    .from("tournament_interest")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)
  if (countError) return { ok: true, count: 0, interested: !currentlyInterested }

  return {
    ok: true,
    count: count ?? 0,
    interested: !currentlyInterested,
  }
}
