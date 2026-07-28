"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient, adminClientMissingReason } from "@/lib/supabase/admin"
import { mapDbPlayerRow, mapDbMatchRow, matchesToDbRows, playerToDbRow } from "@/lib/database/row-mappers"
import { parseTournamentSettings, settingsForPersistence } from "@/lib/tournament-settings"
import {
  applyPairingByeToPlayers,
  createSwissRoundPairings,
  isPairingByeMatch,
  isSwissAlgorithm,
  maybeAdvanceSwissLastCompletedRound,
} from "@/lib/pairing/swiss"
import { effectiveTableSlotsForPairing } from "@/lib/tournament/effective-table-count"

export type PairSwissRoundResult = {
  success: boolean
  error?: string
  createdCount?: number
  round?: number
}

/**
 * Organizer-only: pair the next Club Swiss round on the server.
 */
export async function pairSwissRound(tournamentId: string): Promise<PairSwissRoundResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Sign in required" }

  const admin = createAdminClient()
  if (!admin) return { success: false, error: adminClientMissingReason() }

  const { data: tournament } = await admin.from("tournaments").select("*").eq("id", tournamentId).maybeSingle()
  if (!tournament) return { success: false, error: "Tournament not found" }
  if (tournament.organizer_id !== user.id && tournament.owner_id !== user.id) {
    return { success: false, error: "Only the organizer can pair Swiss rounds" }
  }
  if (tournament.status !== "active") {
    return { success: false, error: "Tournament is not active" }
  }

  const settings = parseTournamentSettings(tournament)
  if (!isSwissAlgorithm(settings.pairingAlgorithm)) {
    return { success: false, error: "Tournament is not using Swiss pairing" }
  }

  const [{ data: playerRows }, { data: matchRows }] = await Promise.all([
    admin.from("players").select("*").eq("tournament_id", tournamentId),
    admin.from("matches").select("*").eq("tournament_id", tournamentId).order("created_at", { ascending: true }),
  ])

  let players = (playerRows ?? []).map(mapDbPlayerRow)
  const allMatches = (matchRows ?? []).map(mapDbMatchRow)

  const tableSlots = effectiveTableSlotsForPairing(
    tournament.tables_count ?? tournament.table_count ?? 0,
    settings,
  )

  const newMatches = createSwissRoundPairings(players, allMatches, settings, tableSlots)
  if (newMatches.length === 0) {
    return {
      success: false,
      error: "Could not create pairings (round not ready, tables short, or rematch conflict)",
    }
  }

  const round = newMatches.find((m) => m.swissRound != null)?.swissRound

  for (const bm of newMatches.filter(isPairingByeMatch)) {
    players = applyPairingByeToPlayers(bm, players, settings)
  }

  const mergedMatches = [...allMatches, ...newMatches]
  const advanced = maybeAdvanceSwissLastCompletedRound(
    { ...settings, pairingAlgorithm: "swiss" },
    mergedMatches,
  )

  const { error: matchErr } = await admin.from("matches").upsert(matchesToDbRows(tournamentId, newMatches))
  if (matchErr) {
    console.error("[pair-swiss-round] matches failed:", matchErr)
    return { success: false, error: "Failed to save pairings" }
  }

  const playerRowsOut = players.map((p) => playerToDbRow(tournamentId, p, advanced))
  const { error: playersErr } = await admin.from("players").upsert(playerRowsOut)
  if (playersErr) {
    console.error("[pair-swiss-round] players failed:", playersErr)
    return { success: false, error: "Failed to save bye scores" }
  }

  // Persist algorithm id as swiss (migrate legacy fide-swiss) + round progress
  const { error: settingsErr } = await admin
    .from("tournaments")
    .update({
      settings: settingsForPersistence({ ...advanced, pairingAlgorithm: "swiss" }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", tournamentId)
  if (settingsErr) {
    console.error("[pair-swiss-round] settings failed:", settingsErr)
    return { success: false, error: "Failed to save round state" }
  }

  return { success: true, createdCount: newMatches.length, round }
}
