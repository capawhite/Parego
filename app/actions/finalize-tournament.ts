"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient, adminClientMissingReason } from "@/lib/supabase/admin"

export type FinalizeTournamentResult = { success: boolean; error?: string }

/**
 * Organizer-only, status-only tournament completion via service role.
 * Match results and player scores are already persisted server-side, so no
 * client match snapshot is written (a stale tab could clobber live submissions).
 */
export async function finalizeTournament(tournamentId: string): Promise<FinalizeTournamentResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Sign in required" }

  const admin = createAdminClient()
  if (!admin) return { success: false, error: adminClientMissingReason() }

  const { data: tournament } = await admin
    .from("tournaments")
    .select("organizer_id, owner_id, status")
    .eq("id", tournamentId)
    .maybeSingle()
  if (!tournament) return { success: false, error: "Tournament not found" }

  if (tournament.organizer_id !== user.id && tournament.owner_id !== user.id) {
    return { success: false, error: "Only the organizer can end the tournament" }
  }

  if (tournament.status === "completed") return { success: true }

  const { error } = await admin
    .from("tournaments")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", tournamentId)

  if (error) {
    console.error("[finalize-tournament] update failed:", error)
    return { success: false, error: "Failed to end tournament" }
  }

  return { success: true }
}
