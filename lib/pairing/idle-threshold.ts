import type { TournamentSettings } from "@/lib/types"

/**
 * Minimum number of idle (not in an active game) players required before auto-pairing.
 * When `settings.minIdlePlayersBeforePairing` is set (>0), uses that value (capped by field size).
 * Otherwise uses max(4, floor(n/4)) so partial rounds can start sooner while games are still in progress.
 */
export function minIdlePlayersBeforePairing(totalPlayers: number, settings: TournamentSettings): number {
  if (totalPlayers <= 0) return 4
  const configured = settings.minIdlePlayersBeforePairing
  if (typeof configured === "number" && configured > 0) {
    return Math.min(totalPlayers, configured)
  }
  const raw = Math.max(4, Math.floor(totalPlayers / 4))
  return Math.min(totalPlayers, raw)
}
