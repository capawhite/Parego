import type { TournamentSettings } from "@/lib/types"

/**
 * Calculate points for a single game result from tournament settings.
 * Used when recording a result (win/draw/loss) and when applying streak multiplier.
 */
export function calculatePointsFromSettings(
  isWinner: boolean,
  isDraw: boolean,
  currentStreak: number,
  settings: TournamentSettings,
): number {
  let basePoints = 0
  if (isDraw) {
    basePoints = settings.drawPoints
  } else if (isWinner) {
    basePoints = settings.winPoints
  } else {
    basePoints = settings.lossPoints
  }
  if (settings.streakEnabled && currentStreak >= 2) {
    return basePoints * settings.streakMultiplier
  }
  return basePoints
}

/**
 * Rebuild per-game points from W/D/L history when `pointsEarned` was not persisted.
 * Mirrors streak progression used when recording results in the arena.
 */
export function pointsEarnedFromGameResults(
  gameResults: ("W" | "D" | "L")[],
  settings: TournamentSettings,
): number[] {
  const out: number[] = []
  let streak = 0
  for (const r of gameResults) {
    const isDraw = r === "D"
    const isWinner = r === "W"
    out.push(calculatePointsFromSettings(isWinner, isDraw, streak, settings))
    if (isDraw) streak = 0
    else if (isWinner) streak += 1
    else streak = 0
  }
  return out
}

