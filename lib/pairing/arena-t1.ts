import type { Match, Player, TournamentSettings } from "@/lib/types"
import type { PlayerMatchCacheEntry } from "./pairing-cache"
export type T1CapPreset = NonNullable<TournamentSettings["t1CapPreset"]>

/**
 * Organizer-side temporary cooldown reductions, keyed by player ID.
 * This is intentionally in-memory (session-scoped) and reset by the panel.
 */
let cooldownReductionMsByPlayerId: Record<string, number> = {}

export function setArenaCooldownReductions(byPlayerId: Record<string, number>): void {
  cooldownReductionMsByPlayerId = byPlayerId
}

function cooldownReductionForPlayerMs(playerId: string): number {
  const value = cooldownReductionMsByPlayerId[playerId]
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.floor(value)
}

/**
 * ARENACHESS T1: "tiempo congelado antes de emparejar" — players who just finished
 * a game are not eligible for a new pairing until match end + T1.
 *
 * UI may still show them as "idle" (not in an active game); pairing uses
 * `filterArenaT1EligiblePlayers` / `shouldPair` with the same filter.
 */

export function tpMsFromSettings(settings: TournamentSettings): number {
  const Tf = (settings.baseTimeMinutes || 5) * 60 * 1000
  const Ta = (settings.incrementSeconds || 0) * 1000
  return Tf * 2 + Ta * 2 * 40
}

/** T1 cap profiles so organizers can tune wait pressure per event. */
export function t1CapMsFromTp(tpMs: number, preset: T1CapPreset = "balanced"): number {
  if (preset === "fast") {
    return Math.max(60_000, Math.min(120_000, Math.round(tpMs * 0.1)))
  }
  if (preset === "strict") {
    return Math.max(120_000, Math.min(300_000, Math.round(tpMs * 0.25)))
  }
  return Math.max(90_000, Math.min(180_000, Math.round(tpMs * 0.15)))
}

function t1PresetFromSettings(settings: TournamentSettings): T1CapPreset {
  return settings.t1CapPreset === "fast" || settings.t1CapPreset === "strict" ? settings.t1CapPreset : "balanced"
}

/** PDF: T1 = (Tp/20)*(Tp/Dp); draw branch; capped by preset. Dp in ms. */
export function t1MsFromLastGame(
  lastResult: "W" | "D" | "L" | undefined,
  dpMs: number,
  tpMs: number,
  preset: T1CapPreset = "balanced",
): number {
  const Dp = Math.max(1, dpMs)
  let T1 = (tpMs / 20) * (tpMs / Dp)
  if (lastResult === "D") {
    T1 = T1 * (tpMs / Dp)
  }
  const capMs = t1CapMsFromTp(tpMs, preset)
  if (T1 > capMs) T1 = capMs
  return T1
}

export function matchEffectiveEndMs(m: Match): number | null {
  if (!m.result?.completed) return null
  if (m.endTime != null) return m.endTime
  if (m.result.completedAt != null) return m.result.completedAt
  return null
}

export function lastCompletedMatchForPlayer(playerId: string, matches: Match[]): Match | undefined {
  const completed = matches.filter(
    (m) => m.result?.completed && (m.player1.id === playerId || m.player2.id === playerId),
  )
  if (completed.length === 0) return undefined
  return completed.sort((a, b) => (matchEffectiveEndMs(b) ?? 0) - (matchEffectiveEndMs(a) ?? 0))[0]
}

/**
 * Earliest wall time when this player may be included in Arena pairing.
 * Never played: `joinedAt` (idle and ready once checked in / in pool).
 * After a game: effective match end + T1.
 */
export function arenaPairingEligibleAtMs(
  player: Player,
  allHistoricalMatches: Match[],
  settings: TournamentSettings,
): number {
  const lastMatch = lastCompletedMatchForPlayer(player.id, allHistoricalMatches)
  if (!lastMatch) {
    return player.joinedAt
  }

  const tpMs = tpMsFromSettings(settings)
  const endMs = matchEffectiveEndMs(lastMatch)
  const startMs = lastMatch.startTime
  const dpMs =
    startMs != null && endMs != null ? Math.max(1, endMs - startMs) : tpMs

  const lastResult = player.gameResults[player.gameResults.length - 1]
  const t1Ms = t1MsFromLastGame(lastResult, dpMs, tpMs, t1PresetFromSettings(settings))

  // Never use Date.now() here — it would push eligibleAt forward every poll and block pairing forever.
  const baseEnd = endMs ?? startMs
  if (baseEnd == null) return 0

  const reductionMs = cooldownReductionForPlayerMs(player.id)
  const reducedT1Ms = Math.max(0, t1Ms - reductionMs)
  return baseEnd + reducedT1Ms
}

export function isArenaT1Eligible(
  player: Player,
  allHistoricalMatches: Match[],
  settings: TournamentSettings,
  nowMs: number,
): boolean {
  return nowMs >= arenaPairingEligibleAtMs(player, allHistoricalMatches, settings)
}

export function filterArenaT1EligiblePlayers(
  players: Player[],
  allHistoricalMatches: Match[],
  settings: TournamentSettings,
  nowMs: number,
): Player[] {
  return players.filter((p) => isArenaT1Eligible(p, allHistoricalMatches, settings, nowMs))
}

/** Wall-clock start for T2 range expansion: when the player became eligible to wait for pairing (PDF: after T1). */
export function arenaWaitClockStartMs(
  player: Player,
  allHistoricalMatches: Match[],
  settings: TournamentSettings,
): number {
  return arenaPairingEligibleAtMs(player, allHistoricalMatches, settings)
}

/**
 * Cached variant of {@link arenaPairingEligibleAtMs} that uses a pre-computed cache entry
 * instead of scanning all matches. O(1) per player instead of O(M log M).
 */
export function arenaPairingEligibleAtMsCached(
  player: Player,
  entry: PlayerMatchCacheEntry,
  settings: TournamentSettings,
): number {
  const lastMatch = entry.lastCompletedMatch
  if (!lastMatch) return player.joinedAt

  const tpMs = tpMsFromSettings(settings)
  const endMs = matchEffectiveEndMs(lastMatch)
  const startMs = lastMatch.startTime
  const dpMs = startMs != null && endMs != null ? Math.max(1, endMs - startMs) : tpMs

  const lastResult = player.gameResults[player.gameResults.length - 1]
  const t1Ms = t1MsFromLastGame(lastResult, dpMs, tpMs, t1PresetFromSettings(settings))

  const baseEnd = endMs ?? startMs
  if (baseEnd == null) return 0

  const reductionMs = cooldownReductionForPlayerMs(player.id)
  const reducedT1Ms = Math.max(0, t1Ms - reductionMs)
  return baseEnd + reducedT1Ms
}
