import type { Match } from "@/lib/types"

/**
 * Get matches visible to a player: only matches they are in.
 * Organizer sees all matches; player sees only their own.
 */
export function getVisibleMatchesForPlayer(matches: Match[], playerId: string | null, role: "player" | "organizer"): Match[] {
  if (role === "organizer" || !playerId) return matches
  return matches.filter((m) => m.player1.id === playerId || m.player2.id === playerId)
}

/**
 * Get the current (pending) match for a player, if any.
 */
export function getMyPendingMatch(matches: Match[], playerId: string): Match | undefined {
  return matches.find(
    (m) => !m.result?.completed && (m.player1.id === playerId || m.player2.id === playerId),
  )
}

/**
 * Get the opponent in a match for a given player id.
 */
export function getOpponentInMatch(match: Match, playerId: string): { id: string; name: string } | null {
  if (match.player1.id === playerId) return { id: match.player2.id, name: match.player2.name }
  if (match.player2.id === playerId) return { id: match.player1.id, name: match.player1.name }
  return null
}
