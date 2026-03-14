"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface DeleteTournamentResponse {
  success: boolean
  error?: string
}

/**
 * Server action to delete a tournament. Organizer only (enforced by RLS).
 * Players and matches are removed by DB CASCADE.
 */
export async function deleteTournament(tournamentId: string): Promise<DeleteTournamentResponse> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: "Authentication required" }
  }

  const { error } = await supabase.from("tournaments").delete().eq("id", tournamentId)

  if (error) {
    console.error("[delete-tournament] Error:", error)
    return { success: false, error: error.message }
  }

  revalidatePath("/")
  revalidatePath(`/tournament/${tournamentId}`)
  return { success: true }
}
