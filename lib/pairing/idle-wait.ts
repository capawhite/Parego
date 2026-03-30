import type { Match, Player } from "@/lib/types"
import { matchEffectiveEndMs } from "./arena-t1"

/** Latest effective end time among completed matches involving this player. */
export function lastCompletedGameEndForPlayer(playerId: string, matches: Match[]): number | null {
  let max: number | null = null
  for (const m of matches) {
    if (!m.result?.completed) continue
    const et = matchEffectiveEndMs(m)
    if (et == null) continue
    if (m.player1.id === playerId || m.player2.id === playerId) {
      if (max == null || et > max) max = et
    }
  }
  return max
}

/**
 * Wall-clock reference for "how long idle": last game end, or join time if never finished a game.
 * If the player has never completed a game, idle time starts from `min(player.joinedAt, poolMinJoinedAt)`
 * so a late joiner is not treated as "just started waiting" and repeatedly skipped when odd player
 * counts force a sit-out.
 */
export function idleWaitStartMsForFairPairing(
  player: Player,
  matches: Match[],
  poolMinJoinedAt: number,
): number {
  const last = lastCompletedGameEndForPlayer(player.id, matches)
  if (last != null) return last
  return Math.min(player.joinedAt, poolMinJoinedAt)
}

/**
 * Players tied for the longest current idle wait among `players` (max of now - idleWaitStart).
 * Uses {@link idleWaitStartMsForFairPairing} so never-played idle aligns with the earliest joiner in the pool.
 */
export function longestWaitingPlayerIds(players: Player[], matches: Match[], nowMs: number): Set<string> {
  if (players.length === 0) return new Set()
  const poolMinJoined = Math.min(...players.map((p) => p.joinedAt))
  let maxDur = -1
  const durById = new Map<string, number>()
  for (const p of players) {
    const start = idleWaitStartMsForFairPairing(p, matches, poolMinJoined)
    const d = Math.max(0, nowMs - start)
    durById.set(p.id, d)
    if (d > maxDur) maxDur = d
  }
  const ids = new Set<string>()
  for (const p of players) {
    if (durById.get(p.id) === maxDur) ids.add(p.id)
  }
  return ids
}
