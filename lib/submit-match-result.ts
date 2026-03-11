/**
 * Shared submit-match-result logic. Used by the server action and the API route.
 * Does not use "use server" so it can be imported from Route Handlers.
 * When both players have submitted the same result, completes the match and updates
 * player scores on the server so it works even if the organizer tab is closed.
 */

import { createClient } from "@supabase/supabase-js"
import { getSubmissionSide, parsePlayerData, type ResultType } from "@/lib/result-utils"
import { calculatePointsFromSettings } from "@/lib/points"
import { DEFAULT_SETTINGS, type TournamentSettings } from "@/lib/types"

export interface SubmitResultResponse {
  success: boolean
  error?: string
  match?: any
  /** True when both players agreed and the match was completed on the server. */
  matchCompleted?: boolean
  /** When matchCompleted, new points/games/streak for the two players so client can update UI. */
  updatedPlayers?: { id: string; points: number; games_played: number; streak: number }[]
}

function getSettings(tournament: { settings?: unknown }): TournamentSettings {
  const s = tournament.settings as Record<string, unknown> | undefined
  if (!s || typeof s !== "object") return { ...DEFAULT_SETTINGS }
  return {
    winPoints: typeof s.winPoints === "number" ? s.winPoints : DEFAULT_SETTINGS.winPoints,
    drawPoints: typeof s.drawPoints === "number" ? s.drawPoints : DEFAULT_SETTINGS.drawPoints,
    lossPoints: typeof s.lossPoints === "number" ? s.lossPoints : DEFAULT_SETTINGS.lossPoints,
    streakEnabled: typeof s.streakEnabled === "boolean" ? s.streakEnabled : DEFAULT_SETTINGS.streakEnabled,
    streakMultiplier: typeof s.streakMultiplier === "number" ? s.streakMultiplier : DEFAULT_SETTINGS.streakMultiplier,
    allowSelfPause: DEFAULT_SETTINGS.allowSelfPause,
    allowLateJoin: DEFAULT_SETTINGS.allowLateJoin,
    minGamesBeforePause: DEFAULT_SETTINGS.minGamesBeforePause,
    avoidRecentRematches: DEFAULT_SETTINGS.avoidRecentRematches,
    colorBalancePriority: DEFAULT_SETTINGS.colorBalancePriority,
    scoreMatchingStrictness: DEFAULT_SETTINGS.scoreMatchingStrictness,
    tableCount: DEFAULT_SETTINGS.tableCount,
    autoEndAtCompletion: DEFAULT_SETTINGS.autoEndAtCompletion,
    completionThreshold: DEFAULT_SETTINGS.completionThreshold,
    pairingAlgorithm: DEFAULT_SETTINGS.pairingAlgorithm,
  }
}

export async function submitMatchResultImpl(
  matchId: string,
  result: ResultType,
  confirmed: boolean,
  options: { playerId?: string; userId?: string },
): Promise<SubmitResultResponse> {
  const { playerId, userId } = options
  if (!userId && !playerId) {
    return { success: false, error: "You must be logged in or provide a player ID to submit results" }
  }

  const adminClient = createClient(
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
    .select("status, settings")
    .eq("id", match.tournament_id)
    .single()

  if (!tournament || tournament.status !== "active") {
    return { success: false, error: "Tournament is not active" }
  }

  if (match.completed) {
    return { success: false, error: "Match is already completed" }
  }

  let side: "player1" | "player2" | null = null
  if (userId) {
    side = getSubmissionSide(userId, match.player1_data, match.player2_data)
  }
  if (!side && playerId) {
    if (match.player1_id === playerId) side = "player1"
    else if (match.player2_id === playerId) side = "player2"
    else {
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
  if (!updatedMatch) return { success: true, match: updatedMatch }

  const p1Sub = updatedMatch.player1_submission
  const p2Sub = updatedMatch.player2_submission
  const bothAgree = p1Sub && p2Sub && p1Sub === p2Sub

  if (bothAgree) {
    const agreedResult = p1Sub as ResultType
    const isDraw = agreedResult === "draw"
    const winnerId = isDraw ? null : agreedResult === "player1-win" ? match.player1_id : match.player2_id
    const completedAt = Date.now()

    const resultPayload = {
      winnerId: winnerId ?? undefined,
      isDraw,
      completed: true,
      completedAt,
    }

    const { error: matchCompleteErr } = await adminClient
      .from("matches")
      .update({
        result: JSON.stringify(resultPayload),
        completed: true,
        completed_at: new Date(completedAt).toISOString(),
      })
      .eq("id", matchId)

    if (matchCompleteErr) {
      console.error("[v0] Error marking match completed:", matchCompleteErr)
      return { success: true, match: updatedMatch }
    }

    const { data: p1Row } = await adminClient.from("players").select("*").eq("id", match.player1_id).eq("tournament_id", match.tournament_id).single()
    const { data: p2Row } = await adminClient.from("players").select("*").eq("id", match.player2_id).eq("tournament_id", match.tournament_id).single()
    const settings = getSettings(tournament)

    if (p1Row && p2Row) {
      const tableNum = match.table_number ?? 0
      const results1 = Array.isArray(p1Row.results) ? [...p1Row.results] : []
      const results2 = Array.isArray(p2Row.results) ? [...p2Row.results] : []
      const opponents1 = Array.isArray(p1Row.opponents) ? [...p1Row.opponents] : []
      const opponents2 = Array.isArray(p2Row.opponents) ? [...p2Row.opponents] : []
      const colors1 = Array.isArray(p1Row.colors) ? [...p1Row.colors] : []
      const colors2 = Array.isArray(p2Row.colors) ? [...p2Row.colors] : []
      const pointsEarned1 = Array.isArray(p1Row.points_earned) ? [...p1Row.points_earned] : []
      const pointsEarned2 = Array.isArray(p2Row.points_earned) ? [...p2Row.points_earned] : []
      const tableNumbers1 = Array.isArray(p1Row.table_numbers) ? [...p1Row.table_numbers] : []
      const tableNumbers2 = Array.isArray(p2Row.table_numbers) ? [...p2Row.table_numbers] : []

      const isP1Winner = agreedResult === "player1-win"
      const isP2Winner = agreedResult === "player2-win"
      const streak1 = Number(p1Row.current_streak) || 0
      const streak2 = Number(p2Row.current_streak) || 0
      const newStreak1 = isDraw ? 0 : isP1Winner ? streak1 + 1 : 0
      const newStreak2 = isDraw ? 0 : isP2Winner ? streak2 + 1 : 0
      const pts1 = calculatePointsFromSettings(isP1Winner, isDraw, streak1, settings)
      const pts2 = calculatePointsFromSettings(isP2Winner, isDraw, streak2, settings)

      results1.push(isP1Winner ? "W" : isDraw ? "D" : "L")
      results2.push(isP2Winner ? "W" : isDraw ? "D" : "L")
      opponents1.push(match.player2_id)
      opponents2.push(match.player1_id)
      colors1.push("white")
      colors2.push("black")
      pointsEarned1.push(pts1)
      pointsEarned2.push(pts2)
      tableNumbers1.push(tableNum)
      tableNumbers2.push(tableNum)

      const wins1 = (results1.filter((r: string) => r === "W").length)
      const draws1 = (results1.filter((r: string) => r === "D").length)
      const losses1 = (results1.filter((r: string) => r === "L").length)
      const wins2 = (results2.filter((r: string) => r === "W").length)
      const draws2 = (results2.filter((r: string) => r === "D").length)
      const losses2 = (results2.filter((r: string) => r === "L").length)
      const points1 = (Number(p1Row.points) || 0) + pts1
      const points2 = (Number(p2Row.points) || 0) + pts2
      const games1 = (Number(p1Row.games_played) || 0) + 1
      const games2 = (Number(p2Row.games_played) || 0) + 1
      const whiteCount1 = (Number(p1Row.white_count) || 0) + 1
      const blackCount2 = (Number(p2Row.black_count) || 0) + 1

      await adminClient.from("players").update({
        points: points1,
        games_played: games1,
        wins: wins1,
        draws: draws1,
        losses: losses1,
        current_streak: newStreak1,
        on_streak: newStreak1 > 0,
        results: results1,
        opponents: opponents1,
        colors: colors1,
        points_earned: pointsEarned1,
        table_numbers: tableNumbers1,
        white_count: whiteCount1,
      }).eq("id", match.player1_id).eq("tournament_id", match.tournament_id)

      await adminClient.from("players").update({
        points: points2,
        games_played: games2,
        wins: wins2,
        draws: draws2,
        losses: losses2,
        current_streak: newStreak2,
        on_streak: newStreak2 > 0,
        results: results2,
        opponents: opponents2,
        colors: colors2,
        points_earned: pointsEarned2,
        table_numbers: tableNumbers2,
        black_count: blackCount2,
      }).eq("id", match.player2_id).eq("tournament_id", match.tournament_id)

      const { data: finalMatch } = await adminClient.from("matches").select("*").eq("id", matchId).single()
      return {
        success: true,
        match: finalMatch ?? updatedMatch,
        matchCompleted: true,
        updatedPlayers: [
          { id: match.player1_id, points: points1, games_played: games1, streak: newStreak1 },
          { id: match.player2_id, points: points2, games_played: games2, streak: newStreak2 },
        ],
      }
    }
  }

  const { data: finalMatch } = await adminClient.from("matches").select("*").eq("id", matchId).single()
  return { success: true, match: finalMatch ?? updatedMatch }
}
