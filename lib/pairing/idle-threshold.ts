import type { TournamentSettings } from "@/lib/types"

/**
 * Minimum number of idle (not in an active game) players required before auto-pairing,
 * Default uses max(4, floor(n/4)) so partial rounds can start sooner while games are still in progress.
 */
export function minIdlePlayersBeforePairing(totalPlayers: number, _settings: TournamentSettings): number {
  if (totalPlayers <= 0) return 4
  const raw = Math.max(4, Math.floor(totalPlayers / 4))
  return Math.min(totalPlayers, raw)
}
