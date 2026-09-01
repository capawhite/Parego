import type { Player } from "@/lib/types"
import { PAIRING_BYE_PLAYER_ID } from "@/lib/types"

/**
 * Performance = points per game (for tiebreaker / display).
 */
export function calculatePerformance(player: Player): number {
  if (player.gamesPlayed === 0) return 0
  return Math.round((player.score / player.gamesPlayed) * 100) / 100
}

/**
 * Buchholz = sum of each opponent's current score, once per game played against them.
 * Arena scores keep changing as the session runs, so this is always derived fresh from
 * the roster's current scores rather than accumulated/stored incrementally.
 */
export function calculateBuchholz(player: Player, scoreById: Map<string, number>): number {
  const total = player.opponentIds.reduce((sum, opponentId) => {
    if (opponentId === PAIRING_BYE_PLAYER_ID) return sum
    return sum + (scoreById.get(opponentId) ?? 0)
  }, 0)
  return Math.round(total * 100) / 100
}

/**
 * Sonneborn-Berger = sum of defeated opponents' current scores, plus half of drawn opponents' scores.
 */
export function calculateSonnebornBerger(player: Player, scoreById: Map<string, number>): number {
  const total = player.opponentIds.reduce((sum, opponentId, i) => {
    if (opponentId === PAIRING_BYE_PLAYER_ID) return sum
    const opponentScore = scoreById.get(opponentId) ?? 0
    const result = player.gameResults[i]
    if (result === "W") return sum + opponentScore
    if (result === "D") return sum + opponentScore / 2
    return sum
  }, 0)
  return Math.round(total * 100) / 100
}

/**
 * Annotate players with live Buchholz / Sonneborn-Berger tiebreaks computed from the
 * roster's current scores.
 */
export function withTiebreaks(players: Player[]): Player[] {
  const scoreById = new Map(players.map((p) => [p.id, p.score]))
  return players.map((player) => ({
    ...player,
    buchholz: calculateBuchholz(player, scoreById),
    sonnebornBerger: calculateSonnebornBerger(player, scoreById),
  }))
}

export type StandingsViewMode = "points" | "performance"

/**
 * Sort players for standings: by points (default) or by performance, with tiebreakers.
 * Tiebreak order: primary metric, then Sonneborn-Berger, then Buchholz, then the
 * secondary metric/games played.
 */
export function sortPlayersByStandings(players: Player[], viewMode: StandingsViewMode): Player[] {
  return withTiebreaks(players).sort((a, b) => {
    if (viewMode === "performance") {
      const perfA = calculatePerformance(a)
      const perfB = calculatePerformance(b)
      if (perfB !== perfA) return perfB - perfA
      if (b.score !== a.score) return b.score - a.score
      if (b.sonnebornBerger !== a.sonnebornBerger) return (b.sonnebornBerger ?? 0) - (a.sonnebornBerger ?? 0)
      if (b.buchholz !== a.buchholz) return (b.buchholz ?? 0) - (a.buchholz ?? 0)
      return a.gamesPlayed - b.gamesPlayed
    }
    if (b.score !== a.score) return b.score - a.score
    if (b.sonnebornBerger !== a.sonnebornBerger) return (b.sonnebornBerger ?? 0) - (a.sonnebornBerger ?? 0)
    if (b.buchholz !== a.buchholz) return (b.buchholz ?? 0) - (a.buchholz ?? 0)
    const perfA = calculatePerformance(a)
    const perfB = calculatePerformance(b)
    if (perfB !== perfA) return perfB - perfA
    return b.gamesPlayed - a.gamesPlayed
  })
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/**
 * Renders already-ranked standings (output of sortPlayersByStandings) as CSV text.
 */
export function standingsToCsv(rankedPlayers: Player[]): string {
  const header = ["Rank", "Name", "Score", "Games", "Performance", "Buchholz", "Sonneborn-Berger"]
  const rows = rankedPlayers.map((player, i) => [
    String(i + 1),
    player.name,
    String(player.score),
    String(player.gamesPlayed),
    calculatePerformance(player).toFixed(2),
    (player.buchholz ?? 0).toFixed(1),
    (player.sonnebornBerger ?? 0).toFixed(1),
  ])
  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n")
}
