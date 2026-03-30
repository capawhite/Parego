import type { Match, Player } from "@/lib/types"

/**
 * Whether a player is available for pairing.
 * A player is eligible when they are not paused, not marked for removal/pause,
 * not currently in an active game, haven't left, and (if venue GPS is required) are checked in.
 */
export function isPlayerAvailableForPairing(
  player: Player,
  activePairingMatches: Match[],
  hasVenue: boolean,
): boolean {
  if (player.paused) return false
  if (player.hasLeft) return false
  if (player.markedForRemoval) return false
  if (player.markedForPause) return false
  if (hasVenue && player.checkedInAt == null) return false
  if (activePairingMatches.some((m) => m.player1.id === player.id || m.player2.id === player.id)) return false
  return true
}
