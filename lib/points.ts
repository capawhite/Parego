import type { TournamentSettings } from "@/lib/types"
import { isSwissAlgorithm } from "@/lib/pairing/swiss"

/** Win / draw / loss for the active pairing mode (Swiss vs arena). */
export function activeScoringTriple(settings: TournamentSettings): { win: number; draw: number; loss: number } {
  if (isSwissAlgorithm(settings.pairingAlgorithm)) {
    return {
      win: settings.swissWinPoints ?? 1,
      draw: settings.swissDrawPoints ?? 0.5,
      loss: settings.swissLossPoints ?? 0,
    }
  }
  return {
    win: settings.winPoints,
    draw: settings.drawPoints,
    loss: settings.lossPoints,
  }
}

/**
 * Calculate points for a single game result from tournament settings.
 * Swiss uses swiss* points; arena uses win/draw/loss + optional streak.
 */
export function calculatePointsFromSettings(
  isWinner: boolean,
  isDraw: boolean,
  currentStreak: number,
  settings: TournamentSettings,
): number {
  const { win, draw, loss } = activeScoringTriple(settings)
  let basePoints = 0
  if (isDraw) {
    basePoints = draw
  } else if (isWinner) {
    basePoints = win
  } else {
    basePoints = loss
  }
  if (isSwissAlgorithm(settings.pairingAlgorithm)) {
    return basePoints
  }
  if (settings.streakEnabled && currentStreak >= 2) {
    return basePoints * settings.streakMultiplier
  }
  return basePoints
}

/**
 * Rebuild per-game points from W/D/L history when `pointsEarned` was not persisted.
 */
export function pointsEarnedFromGameResults(
  gameResults: ("W" | "D" | "L")[],
  settings: TournamentSettings,
): number[] {
  const out: number[] = []
  const swiss = isSwissAlgorithm(settings.pairingAlgorithm)
  let streak = 0
  for (const r of gameResults) {
    const isDraw = r === "D"
    const isWinner = r === "W"
    out.push(calculatePointsFromSettings(isWinner, isDraw, streak, settings))
    if (!swiss) {
      if (isDraw) streak = 0
      else if (isWinner) streak += 1
      else streak = 0
    }
  }
  return out
}
