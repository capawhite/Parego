/**
 * Single source of truth for mapping players/matches between DB rows and app types.
 * Pure functions — safe to import from client code, server actions, and API routes.
 */

import { pointsEarnedFromGameResults } from "@/lib/points"
import type { Match, Player, TournamentSettings } from "@/lib/types"

type DbRow = Record<string, any>

// ── Players ─────────────────────────────────────────────────────────────────

export function mapDbPlayerRow(p: DbRow): Player {
  return {
    id: p.id,
    name: p.name,
    score: p.points || 0,
    gamesPlayed: p.games_played || 0,
    streak: p.current_streak || 0,
    performance: 0,
    active: !p.paused,
    paused: p.paused || false,
    hasLeft: p.is_removed || false,
    markedForRemoval: p.is_removed || false,
    markedForPause: p.is_paused && !p.paused ? true : false,
    joinedAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
    opponentIds: Array.isArray(p.opponents) ? p.opponents : [],
    gameResults: Array.isArray(p.results) ? p.results : [],
    pieceColors: Array.isArray(p.colors) ? p.colors : [],
    pointsEarned: Array.isArray(p.points_earned) ? p.points_earned : [],
    tableNumbers: Array.isArray(p.table_numbers) ? p.table_numbers : [],
    userId: p.user_id ?? null,
    isGuest: p.is_guest ?? false,
    checkedInAt: p.checked_in_at ? new Date(p.checked_in_at).getTime() : null,
    presenceSource: p.presence_source ?? null,
    rating: p.rating ?? null,
    receivedPairingBye: p.received_pairing_bye === true,
    receivedForfeitWin: p.received_forfeit_win === true,
  }
}

export function playerToDbRow(
  tournamentId: string,
  player: Player,
  scoringSettings: TournamentSettings,
): DbRow {
  return {
    id: player.id,
    tournament_id: tournamentId,
    name: player.name,
    user_id: player.userId ?? null,
    is_guest: player.isGuest ?? false,
    points: player.score,
    wins: player.gameResults.filter((r) => r === "W").length,
    draws: player.gameResults.filter((r) => r === "D").length,
    losses: player.gameResults.filter((r) => r === "L").length,
    games_played: player.gamesPlayed,
    white_count: player.pieceColors.filter((c) => c === "white").length,
    black_count: player.pieceColors.filter((c) => c === "black").length,
    current_streak: player.streak,
    on_streak: player.streak > 0,
    paused: player.paused,
    game_history: player.gameResults,
    opponents: player.opponentIds,
    results: player.gameResults,
    colors: player.pieceColors,
    points_earned:
      player.pointsEarned ?? pointsEarnedFromGameResults(player.gameResults, scoringSettings),
    table_numbers: player.tableNumbers || [],
    checked_in_at: player.checkedInAt != null ? new Date(player.checkedInAt).toISOString() : null,
    presence_source: player.presenceSource ?? null,
    rating: player.rating ?? null,
    received_pairing_bye: player.receivedPairingBye ?? false,
    received_forfeit_win: player.receivedForfeitWin ?? false,
  }
}

// ── Matches ─────────────────────────────────────────────────────────────────

export function mapDbMatchRow(m: DbRow): Match {
  // Parse result: JSON format, with fallback for legacy plain string rows.
  let result: Match["result"]
  if (m.result) {
    try {
      const parsed = JSON.parse(String(m.result))
      if (parsed && typeof parsed.completed === "boolean") {
        result = parsed
      } else {
        throw new Error("Invalid format")
      }
    } catch {
      // Legacy format: plain string "draw" | "player1-win" | "player2-win"
      const str = String(m.result)
      if (["draw", "player1-win", "player2-win"].includes(str)) {
        const isDraw = str === "draw"
        result = {
          winnerId: isDraw ? undefined : str === "player1-win" ? m.player1_id : m.player2_id,
          isDraw,
          completed: true,
          completedAt: m.completed_at ? new Date(m.completed_at).getTime() : Date.now(),
        }
      }
    }
  }

  const createdMs = m.created_at ? new Date(m.created_at).getTime() : undefined
  const completedMs = m.completed_at ? new Date(m.completed_at).getTime() : undefined
  if (result?.completed && result.completedAt == null && completedMs != null) {
    result = { ...result, completedAt: completedMs }
  }

  return {
    id: m.id,
    player1: m.player1_data ? JSON.parse(m.player1_data) : { id: m.player1_id, name: "Unknown" },
    player2: m.player2_data ? JSON.parse(m.player2_data) : { id: m.player2_id, name: "Unknown" },
    tableNumber: m.table_number ?? undefined,
    startTime: createdMs,
    endTime: result?.completed ? completedMs ?? result.completedAt : undefined,
    result,
    player1Submission: m.player1_submission
      ? {
          result: m.player1_submission,
          timestamp: m.player1_submission_time
            ? new Date(m.player1_submission_time).getTime()
            : Date.now(),
          confirmed: true,
        }
      : undefined,
    player2Submission: m.player2_submission
      ? {
          result: m.player2_submission,
          timestamp: m.player2_submission_time
            ? new Date(m.player2_submission_time).getTime()
            : Date.now(),
          confirmed: true,
        }
      : undefined,
    disputeStatus: m.dispute_status || "none",
    swissRound: m.swiss_round != null ? Number(m.swiss_round) : undefined,
    matchKind: m.match_kind === "pairing-bye" || m.match_kind === "play" ? m.match_kind : undefined,
  }
}

export function matchToDbRow(tournamentId: string, match: Match): DbRow {
  return {
    id: match.id,
    tournament_id: tournamentId,
    player1_id: match.player1.id,
    player2_id: match.player2.id,
    player1_data: JSON.stringify(match.player1),
    player2_data: JSON.stringify(match.player2),
    table_number: match.tableNumber || null,
    result: match.result ? JSON.stringify(match.result) : null,
    completed: match.result?.completed || false,
    completed_at: match.result?.completedAt ? new Date(match.result.completedAt).toISOString() : null,
    player1_submission: match.player1Submission?.confirmed ? match.player1Submission.result : null,
    player2_submission: match.player2Submission?.confirmed ? match.player2Submission.result : null,
    player1_submission_time: match.player1Submission?.confirmed
      ? new Date(match.player1Submission.timestamp).toISOString()
      : null,
    player2_submission_time: match.player2Submission?.confirmed
      ? new Date(match.player2Submission.timestamp).toISOString()
      : null,
    dispute_status: match.disputeStatus || "none",
    swiss_round: match.swissRound ?? null,
    match_kind: match.matchKind ?? "play",
  }
}

export function matchesToDbRows(tournamentId: string, matches: Match[]): DbRow[] {
  return matches.map((m) => matchToDbRow(tournamentId, m))
}
