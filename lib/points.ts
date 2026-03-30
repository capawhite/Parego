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

