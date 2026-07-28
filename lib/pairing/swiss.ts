/**
 * Club Swiss v1 — score order, no rematch, upper↔lower half, colors, pairing bye.
 * Not FIDE Dutch or USCF-certified. Round-gated: call only when the previous round is complete.
 */

import type { Match, Player, TournamentSettings } from "@/lib/types"
import { PAIRING_BYE_PLAYER_ID } from "@/lib/types"
import type { PairingAlgorithm } from "./types"
import { bestOrientationForPair } from "./color-consecutive-cap"
import { calculatePointsFromSettings } from "@/lib/points"

/** Club Swiss floor: fewer rounds is basically a short match, not a Swiss. */
export const MIN_SWISS_ROUNDS = 3
/** Absolute ceiling when field size is unknown (create form). */
export const MAX_SWISS_ROUNDS = 11
/** Need enough players for a sensible Swiss (and for min rounds ≤ N−1). */
export const MIN_SWISS_PLAYERS = 4

export function isSwissAlgorithm(algorithmId: string | undefined | null): boolean {
  return algorithmId === "swiss" || algorithmId === "fide-swiss"
}

/**
 * Max rounds before a full round-robin (forced rematches). For N players: N−1.
 * Capped by {@link MAX_SWISS_ROUNDS}. Returns 0 when the field is too small for Club Swiss.
 */
export function maxSwissRoundsForPlayerCount(playerCount: number): number {
  if (playerCount < MIN_SWISS_PLAYERS) return 0
  return Math.min(MAX_SWISS_ROUNDS, playerCount - 1)
}

/** Clamp planned rounds to Club Swiss bounds; optionally tighten by field size. */
export function clampPlannedSwissRounds(rounds: number, playerCount?: number): number {
  const parsed = Number.isFinite(rounds) ? Math.floor(rounds) : MIN_SWISS_ROUNDS
  const max =
    playerCount != null && playerCount >= MIN_SWISS_PLAYERS
      ? maxSwissRoundsForPlayerCount(playerCount)
      : MAX_SWISS_ROUNDS
  return Math.min(max, Math.max(MIN_SWISS_ROUNDS, parsed))
}

export type SwissFieldValidation = { valid: true } | { valid: false; errors: string[] }

/** Validate planned rounds and optional player count against Club Swiss limits. */
export function validateSwissTournamentField(
  settings: Pick<TournamentSettings, "pairingAlgorithm" | "plannedSwissRounds">,
  playerCount?: number,
): SwissFieldValidation {
  if (!isSwissAlgorithm(settings.pairingAlgorithm)) return { valid: true }
  const errors: string[] = []
  const planned = settings.plannedSwissRounds ?? 0
  if (planned < MIN_SWISS_ROUNDS || planned > MAX_SWISS_ROUNDS) {
    errors.push(`plannedSwissRounds must be ${MIN_SWISS_ROUNDS}–${MAX_SWISS_ROUNDS}`)
  }
  if (playerCount != null) {
    if (playerCount < MIN_SWISS_PLAYERS) {
      errors.push(`Swiss needs at least ${MIN_SWISS_PLAYERS} players`)
    } else {
      const maxR = maxSwissRoundsForPlayerCount(playerCount)
      if (planned > maxR) {
        errors.push(`With ${playerCount} players, planned rounds cannot exceed ${maxR} (players − 1)`)
      }
    }
  }
  return errors.length === 0 ? { valid: true } : { valid: false, errors }
}


export function isPairingByeMatch(m: Match): boolean {
  return m.matchKind === "pairing-bye" || m.player2?.id === PAIRING_BYE_PLAYER_ID
}

function byeOpponentPlayer(): Player {
  return {
    id: PAIRING_BYE_PLAYER_ID,
    name: "Bye",
    score: 0,
    gamesPlayed: 0,
    streak: 0,
    performance: 0,
    active: false,
    paused: false,
    joinedAt: 0,
    opponentIds: [],
    gameResults: [],
    pieceColors: [],
  }
}

function playedPairKey(aId: string, bId: string): string {
  return aId < bId ? `${aId}:${bId}` : `${bId}:${aId}`
}

function hasPlayedEachOther(a: Player, b: Player, historical: Match[]): boolean {
  const key = playedPairKey(a.id, b.id)
  for (const m of historical) {
    if (isPairingByeMatch(m)) continue
    if (!m.player1?.id || !m.player2?.id) continue
    if (playedPairKey(m.player1.id, m.player2.id) === key) return true
  }
  return false
}

function rankPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const ra = a.rating ?? 0
    const rb = b.rating ?? 0
    if (rb !== ra) return rb - ra
    return a.name.localeCompare(b.name)
  })
}

/** Next round number to pair, or null if blocked / finished. */
export function nextSwissRoundToPair(settings: TournamentSettings, allMatches: Match[]): number | null {
  if (!isSwissAlgorithm(settings.pairingAlgorithm)) return null
  const planned = settings.plannedSwissRounds ?? 1
  const last = settings.swissLastCompletedRound ?? 0
  const next = last + 1
  if (next > planned) return null

  const inRound = allMatches.filter((m) => m.swissRound === next)
  if (inRound.length > 0) return null

  const priorPlay = allMatches.filter(
    (m) => (m.swissRound ?? 0) > 0 && (m.swissRound ?? 0) < next && !isPairingByeMatch(m),
  )
  if (priorPlay.some((m) => !m.result?.completed)) return null

  return next
}

export function canPairNextSwissRound(settings: TournamentSettings, allMatches: Match[]): boolean {
  return nextSwissRoundToPair(settings, allMatches) != null
}

export function maybeAdvanceSwissLastCompletedRound(
  settings: TournamentSettings,
  allMatches: Match[],
): TournamentSettings {
  if (!isSwissAlgorithm(settings.pairingAlgorithm)) return settings
  const planned = settings.plannedSwissRounds ?? 1
  let completed = 0
  for (let r = 1; r <= planned; r++) {
    const inRound = allMatches.filter((m) => m.swissRound === r)
    if (inRound.length === 0) break
    if (inRound.every((m) => m.result?.completed || isPairingByeMatch(m))) completed = r
    else break
  }
  return { ...settings, swissLastCompletedRound: completed }
}

function pickByeRecipient(sortedByScore: Player[]): Player {
  const eligible = sortedByScore.filter((p) => !p.receivedPairingBye && !p.receivedForfeitWin)
  const pool = eligible.length > 0 ? eligible : sortedByScore
  return pool[pool.length - 1]!
}

/**
 * Greedy Swiss pairing: walk score-sorted list; each player takes the next
 * unpaired opponent who is as close in score as possible and not a rematch.
 */
function pairPlayMatches(
  pool: Player[],
  historical: Match[],
  settings: TournamentSettings,
  round: number,
  maxTables: number,
): Match[] | null {
  const remaining = rankPlayers(pool)
  const matches: Match[] = []
  let table = 1
  const priority = settings.colorBalancePriority ?? "high"
  const capMode =
    settings.swissLastRoundColorRelax && round === (settings.plannedSwissRounds ?? 1) ? "relaxed" : "strict"
  const longestWait = new Set(pool.map((p) => p.id))

  while (remaining.length >= 2 && matches.length < maxTables) {
    const a = remaining.shift()!
    let bi = remaining.findIndex((p) => !hasPlayedEachOther(a, p, historical))
    if (bi < 0) {
      // Cannot avoid rematch for this player — fail the whole round
      return null
    }
    const b = remaining.splice(bi, 1)[0]!
    const orient =
      bestOrientationForPair(a, b, priority, capMode, longestWait) ??
      bestOrientationForPair(a, b, priority, "relaxed", longestWait) ?? {
        whitePlayer: a,
        blackPlayer: b,
        cost: 0,
      }
    matches.push({
      id: `swiss-r${round}-${orient.whitePlayer.id}-${orient.blackPlayer.id}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      player1: orient.whitePlayer,
      player2: orient.blackPlayer,
      swissRound: round,
      matchKind: "play",
      tableNumber: table++,
      startTime: Date.now(),
    })
  }

  if (remaining.length > 0) return null
  return matches
}

export function createSwissRoundPairings(
  availablePlayers: Player[],
  allHistoricalMatches: Match[],
  settings: TournamentSettings,
  maxTables: number,
): Match[] {
  const round = nextSwissRoundToPair(settings, allHistoricalMatches)
  if (round == null) return []

  let pool = availablePlayers.filter((p) => !p.hasLeft && !p.paused)
  pool = rankPlayers(pool)
  if (pool.length < MIN_SWISS_PLAYERS) return []

  const playSlotsNeeded = Math.floor(pool.length / 2)
  if (maxTables < playSlotsNeeded) return []

  let byePlayer: Player | null = null
  let playPool = pool
  if (pool.length % 2 === 1) {
    byePlayer = pickByeRecipient(pool)
    playPool = pool.filter((p) => p.id !== byePlayer!.id)
  }

  const playMatches = pairPlayMatches(playPool, allHistoricalMatches, settings, round, maxTables)
  if (!playMatches || playMatches.length !== playSlotsNeeded) return []

  const out: Match[] = [...playMatches]
  if (byePlayer) {
    const now = Date.now()
    out.push({
      id: `swiss-bye-r${round}-${byePlayer.id}-${now}-${Math.random().toString(36).slice(2, 7)}`,
      player1: byePlayer,
      player2: byeOpponentPlayer(),
      swissRound: round,
      matchKind: "pairing-bye",
      tableNumber: 0,
      startTime: now,
      result: {
        winnerId: byePlayer.id,
        isDraw: false,
        completed: true,
        completedAt: now,
      },
    })
  }
  return out
}

export function applyPairingByeToPlayers(
  byeMatch: Match,
  players: Player[],
  settings: TournamentSettings,
): Player[] {
  if (!isPairingByeMatch(byeMatch) || !byeMatch.result?.completed) return players
  const winnerId = byeMatch.result.winnerId
  if (!winnerId) return players

  return players.map((p) => {
    if (p.id !== winnerId) return p
    const points = calculatePointsFromSettings(true, false, 0, settings)
    return {
      ...p,
      score: p.score + points,
      gamesPlayed: p.gamesPlayed + 1,
      streak: 0,
      opponentIds: [...p.opponentIds, PAIRING_BYE_PLAYER_ID],
      gameResults: [...p.gameResults, "W" as const],
      pointsEarned: [...(p.pointsEarned || []), points],
      tableNumbers: [...(p.tableNumbers || []), 0],
      receivedPairingBye: true,
    }
  })
}

export const swissAlgorithm: PairingAlgorithm = {
  id: "swiss",
  name: "Swiss",
  description: "Round-based club Swiss: pair after each round completes. Not FIDE/USCF certified.",
  createPairings(availablePlayers, allHistoricalMatches, settings, maxMatches) {
    return createSwissRoundPairings(availablePlayers, allHistoricalMatches, settings, maxMatches ?? 999)
  },
  shouldPair() {
    return false
  },
  getPollingInterval() {
    return 60_000
  },
  validateSettings(settings) {
    const result = validateSwissTournamentField(settings)
    return result.valid ? { valid: true, errors: [] } : { valid: false, errors: result.errors }
  },
}
