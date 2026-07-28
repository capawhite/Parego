"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient, adminClientMissingReason } from "@/lib/supabase/admin"
import { mergeMatchesForSave } from "@/lib/tournament/merge-matches"
import type { Match, Player, TournamentSettings } from "@/lib/types"

export type RecordOrganizerMatchResultResponse = {
  success: boolean
  error?: string
}

async function assertOrganizer(tournamentId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient()
  if (!admin) return false
  const { data } = await admin
    .from("tournaments")
    .select("organizer_id, owner_id")
    .eq("id", tournamentId)
    .maybeSingle()
  if (!data) return false
  return data.organizer_id === userId || data.owner_id === userId
}

function playersToScoreUpdates(players: Player[]) {
  return players.map((p) => ({
    id: p.id,
    points: p.score,
    games_played: p.gamesPlayed,
    current_streak: p.streak,
    opponents: p.opponentIds,
    results: p.gameResults,
    colors: p.pieceColors,
    points_earned: p.pointsEarned ?? [],
    table_numbers: p.tableNumbers ?? [],
    paused: p.paused,
    is_paused: !!p.markedForPause,
    is_removed: !!p.hasLeft || !!p.markedForRemoval,
  }))
}

/**
 * Organizer-only: persist a completed match result and updated player scores via service role.
 */
export async function recordOrganizerMatchResult(input: {
  tournamentId: string
  matchId: string
  winnerId?: string
  isDraw: boolean
  players: Player[]
  pairedMatches: Match[]
  allTimeMatches: Match[]
  settings: TournamentSettings
}): Promise<RecordOrganizerMatchResultResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Sign in required" }

  if (!(await assertOrganizer(input.tournamentId, user.id))) {
    return { success: false, error: "Only the organizer can record results" }
  }

  const admin = createAdminClient()
  if (!admin) return { success: false, error: adminClientMissingReason() }

  const allMatches = mergeMatchesForSave(input.pairedMatches, input.allTimeMatches)
  const dbMatches = allMatches.map((m) => ({
    id: m.id,
    tournament_id: input.tournamentId,
    player1_id: m.player1.id,
    player2_id: m.player2.id,
    player1_data: JSON.stringify(m.player1),
    player2_data: JSON.stringify(m.player2),
    table_number: m.tableNumber || null,
    result: m.result ? JSON.stringify(m.result) : null,
    completed: m.result?.completed || false,
    completed_at: m.result?.completedAt ? new Date(m.result.completedAt).toISOString() : null,
    player1_submission: m.player1Submission?.confirmed ? m.player1Submission.result : null,
    player2_submission: m.player2Submission?.confirmed ? m.player2Submission.result : null,
    player1_submission_time: m.player1Submission?.confirmed
      ? new Date(m.player1Submission.timestamp).toISOString()
      : null,
    player2_submission_time: m.player2Submission?.confirmed
      ? new Date(m.player2Submission.timestamp).toISOString()
      : null,
    dispute_status: m.disputeStatus || "none",
    swiss_round: m.swissRound ?? null,
    match_kind: m.matchKind ?? "play",
  }))

  const { error: upsertErr } = await admin.from("matches").upsert(dbMatches)
  if (upsertErr) {
    console.error("[recordOrganizerMatchResult] matches upsert failed:", upsertErr)
    return { success: false, error: "Failed to save matches" }
  }

  for (const patch of playersToScoreUpdates(input.players)) {
    const { id, ...fields } = patch
    const { error: pErr } = await admin
      .from("players")
      .update(fields)
      .eq("id", id)
      .eq("tournament_id", input.tournamentId)
    if (pErr) {
      console.error("[recordOrganizerMatchResult] player update failed:", pErr)
      return { success: false, error: "Failed to save player scores" }
    }
  }

  return { success: true }
}

/**
 * Organizer override of a historical game result — persists recalculated scores.
 */
export async function saveOrganizerPlayerScores(input: {
  tournamentId: string
  players: Player[]
}): Promise<RecordOrganizerMatchResultResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Sign in required" }
  if (!(await assertOrganizer(input.tournamentId, user.id))) {
    return { success: false, error: "Only the organizer can override results" }
  }

  const admin = createAdminClient()
  if (!admin) return { success: false, error: adminClientMissingReason() }

  for (const patch of playersToScoreUpdates(input.players)) {
    const { id, paused: _p, is_paused: _ip, is_removed: _ir, ...scoreFields } = patch
    void _p
    void _ip
    void _ir
    const { error: pErr } = await admin
      .from("players")
      .update(scoreFields)
      .eq("id", id)
      .eq("tournament_id", input.tournamentId)
    if (pErr) {
      console.error("[saveOrganizerPlayerScores] failed:", pErr)
      return { success: false, error: "Failed to save player scores" }
    }
  }

  return { success: true }
}
