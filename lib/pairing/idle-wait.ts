import type { Match, Player } from "@/lib/types"

/** Latest `endTime` among completed matches involving this player. */
export function lastCompletedGameEndForPlayer(playerId: string, matches: Match[]): number | null {
  let max: number | null = null
  for (const m of matches) {
    if (!m.result?.completed) continue
    const et = m.endTime
    if (et == null) continue
    if (m.player1.id === playerId || m.player2.id === playerId) {
      if (max == null || et > max) max = et
    }
  }
  return max
}

/** Wall-clock reference for "how long idle": last game end, or join time if never finished a game. */
export function idleWaitStartMs(player: Player, matches: Match[]): number {
  return lastCompletedGameEndForPlayer(player.id, matches) ?? player.joinedAt
}

/**
 * Players tied for the longest current idle wait among `players` (max of now - idleWaitStart).
 */
export function longestWaitingPlayerIds(players: Player[], matches: Match[], nowMs: number): Set<string> {
  if (players.length === 0) return new Set()
  let maxDur = -1
  const durById = new Map<string, number>()
  for (const p of players) {
    const start = idleWaitStartMs(p, matches)
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
