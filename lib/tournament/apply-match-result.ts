import type { Match, Player, TournamentSettings } from "@/lib/types"
import { PAIRING_BYE_PLAYER_ID } from "@/lib/types"
import { calculatePointsFromSettings } from "@/lib/points"
import { isPairingByeMatch } from "@/lib/pairing/fide-swiss"

export type ApplyMatchResultInput = {
  pairedMatches: Match[]
  allTimeMatches: Match[]
  players: Player[]
  settings: TournamentSettings
  matchId: string
  winnerId: string | undefined
  isDraw: boolean
  /** When true (balanced-strength), remove completed match from paired list. */
  removeCompletedFromPaired: boolean
}

export type ApplyMatchResultOutput = {
  ok: boolean
  reason?: "not_found" | "already_completed" | "pairing_bye"
  pairedMatches: Match[]
  allTimeMatches: Match[]
  players: Player[]
  completedMatch?: Match
}

/**
 * Pure application of a finished game onto local arena state (scores + history).
 * Used by TD recordResult; server dual-agree path owns DB scoring separately.
 */
export function applyMatchResultToState(input: ApplyMatchResultInput): ApplyMatchResultOutput {
  const matchIndex = input.pairedMatches.findIndex((m) => m.id === input.matchId)
  if (matchIndex === -1) {
    return {
      ok: false,
      reason: "not_found",
      pairedMatches: input.pairedMatches,
      allTimeMatches: input.allTimeMatches,
      players: input.players,
    }
  }

  const match = input.pairedMatches[matchIndex]
  if (isPairingByeMatch(match)) {
    return {
      ok: false,
      reason: "pairing_bye",
      pairedMatches: input.pairedMatches,
      allTimeMatches: input.allTimeMatches,
      players: input.players,
    }
  }
  if (match.result?.completed) {
    return {
      ok: false,
      reason: "already_completed",
      pairedMatches: input.pairedMatches,
      allTimeMatches: input.allTimeMatches,
      players: input.players,
    }
  }

  const completedAt = Date.now()
  const updatedMatch: Match = {
    ...match,
    endTime: completedAt,
    result: {
      winnerId: input.winnerId,
      isDraw: input.isDraw,
      completed: true,
      completedAt,
    },
  }

  let newPlayers = input.players.map((player) => {
    if (player.id !== match.player1.id && player.id !== match.player2.id) {
      return player
    }
    if (player.id === match.player2.id && match.player2.id === PAIRING_BYE_PLAYER_ID) {
      return player
    }

    const isPlayer1 = player.id === match.player1.id
    const isWinner = input.winnerId === player.id
    const opponent = isPlayer1 ? match.player2 : match.player1
    const currentStreak = player.streak
    const swiss = input.settings.pairingAlgorithm === "fide-swiss"
    let newStreak = player.streak

    if (swiss) {
      newStreak = 0
    } else if (input.isDraw) {
      newStreak = 0
    } else if (isWinner) {
      newStreak = player.streak + 1
    } else {
      newStreak = 0
    }

    const points = calculatePointsFromSettings(isWinner, input.isDraw, currentStreak, input.settings)
    let gameResult: "W" | "D" | "L"
    if (input.isDraw) gameResult = "D"
    else if (isWinner) gameResult = "W"
    else gameResult = "L"
    const pieceColor: "white" | "black" = isPlayer1 ? "white" : "black"

    return {
      ...player,
      score: player.score + points,
      gamesPlayed: player.gamesPlayed + 1,
      streak: newStreak,
      opponentIds: [...player.opponentIds, opponent.id],
      gameResults: [...player.gameResults, gameResult],
      pieceColors: [...player.pieceColors, pieceColor],
      pointsEarned: [...(player.pointsEarned || []), points],
      tableNumbers: [...(player.tableNumbers || []), match.tableNumber || 0],
    }
  })

  let newPairedMatches: Match[]
  if (input.removeCompletedFromPaired) {
    newPairedMatches = input.pairedMatches.filter((m) => m.id !== input.matchId)
  } else {
    newPairedMatches = [...input.pairedMatches]
    newPairedMatches[matchIndex] = updatedMatch
  }

  const newAllTimeMatches = [...input.allTimeMatches, updatedMatch]

  newPlayers = newPlayers.map((player) => {
    const hadMatchJustCompleted =
      updatedMatch.player1.id === player.id || updatedMatch.player2.id === player.id
    if (!hadMatchJustCompleted) return player
    if (player.markedForRemoval) {
      return { ...player, hasLeft: true, active: false }
    }
    if (player.markedForPause) {
      return { ...player, paused: true, markedForPause: false }
    }
    return player
  })

  return {
    ok: true,
    pairedMatches: newPairedMatches,
    allTimeMatches: newAllTimeMatches,
    players: newPlayers,
    completedMatch: updatedMatch,
  }
}
