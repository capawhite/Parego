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
 * Point change for a single result (W/D/L) with optional streak multiplier.
 * Default scoring: W=2, D=1, L=0; streak >= 2 doubles points.
 */
export function calculatePointChange(result: "W" | "D" | "L", streakBefore: number, streakMultiplier = 2): number {
  const hasStreak = streakBefore >= 2
  if (result === "W") return hasStreak ? 4 : 2
  if (result === "D") return hasStreak ? 2 : 1
  return 0
}
