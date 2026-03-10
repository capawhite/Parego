import type { Player } from "@/lib/types"

/**
 * Performance = points per game (for tiebreaker / display).
 */
export function calculatePerformance(player: Player): number {
  if (player.gamesPlayed === 0) return 0
  return Math.round((player.score / player.gamesPlayed) * 100) / 100
}

export type StandingsViewMode = "points" | "performance"

/**
 * Sort players for standings: by points (default) or by performance, with tiebreakers.
 */
export function sortPlayersByStandings(players: Player[], viewMode: StandingsViewMode): Player[] {
  return [...players].sort((a, b) => {
    if (viewMode === "performance") {
      const perfA = calculatePerformance(a)
      const perfB = calculatePerformance(b)
      if (perfB !== perfA) return perfB - perfA
      if (b.score !== a.score) return b.score - a.score
      return a.gamesPlayed - b.gamesPlayed
    }
    if (b.score !== a.score) return b.score - a.score
    const perfA = calculatePerformance(a)
    const perfB = calculatePerformance(b)
    if (perfB !== perfA) return perfB - perfA
    return b.gamesPlayed - a.gamesPlayed
  })
}
