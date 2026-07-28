"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient, adminClientMissingReason } from "@/lib/supabase/admin"
import { matchesToDbRows, playerToDbRow } from "@/lib/database/row-mappers"
import { parseTournamentSettings, settingsForPersistence } from "@/lib/tournament-settings"
import type { Match, Player, TournamentSettings } from "@/lib/types"

export type SaveSwissRoundResult = { success: boolean; error?: string }

/**
 * Organizer-only persistence for Swiss rounds (pairings, TD results) via service role.
 * Optionally updates tournament settings (e.g. swissLastCompletedRound advancement).
 */
export async function saveSwissRoundState(input: {
  tournamentId: string
  players: Player[]
  matches: Match[]
  settings?: TournamentSettings
}): Promise<SaveSwissRoundResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Sign in required" }

  const admin = createAdminClient()
  if (!admin) return { success: false, error: adminClientMissingReason() }

  const { data: tournament } = await admin
    .from("tournaments")
    .select("organizer_id, owner_id, settings")
    .eq("id", input.tournamentId)
    .maybeSingle()
  if (!tournament) return { success: false, error: "Tournament not found" }

  if (tournament.organizer_id !== user.id && tournament.owner_id !== user.id) {
    return { success: false, error: "Only the organizer can save Swiss rounds" }
  }

  const scoringSettings = input.settings ?? parseTournamentSettings(tournament)

  const playerRows = input.players.map((p) => playerToDbRow(input.tournamentId, p, scoringSettings))
  const { error: playersErr } = await admin.from("players").upsert(playerRows)
  if (playersErr) {
    console.error("[save-swiss-round] players upsert failed:", playersErr)
    return { success: false, error: "Failed to save players" }
  }

  const { error: matchesErr } = await admin
    .from("matches")
    .upsert(matchesToDbRows(input.tournamentId, input.matches))
  if (matchesErr) {
    console.error("[save-swiss-round] matches upsert failed:", matchesErr)
    return { success: false, error: "Failed to save matches" }
  }

  if (input.settings) {
    const { error: settingsErr } = await admin
      .from("tournaments")
      .update({
        settings: settingsForPersistence(input.settings),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.tournamentId)
    if (settingsErr) {
      console.error("[save-swiss-round] settings update failed:", settingsErr)
      return { success: false, error: "Failed to save settings" }
    }
  }

  return { success: true }
}
