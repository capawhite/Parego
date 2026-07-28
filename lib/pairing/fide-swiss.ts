import type { Player, Match, TournamentSettings } from "@/lib/types"
import { PAIRING_BYE_PLAYER_ID } from "@/lib/types"
import type { PairingAlgorithm } from "./types"
import { bestOrientationForPair } from "./color-consecutive-cap"
import { calculatePointsFromSettings } from "@/lib/points"

export { PAIRING_BYE_PLAYER_ID }

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
    if (m.matchKind === "pairing-bye" || isPairingByeMatch(m)) continue
    if (!m.player1?.id || !m.player2?.id) continue
    const mk = playedPairKey(m.player1.id, m.player2.id)
    if (mk === key) return true
  }
  return false
}

/** Merge paired + all-time for Swiss round completion checks */
export function mergeMatchesForSwiss(paired: Match[], allTime: Match[]): Match[] {
  const map = new Map<string, Match>()
  for (const m of paired) map.set(m.id, m)
  for (const m of allTime) map.set(m.id, m)
  return [...map.values()]
}

export function nextSwissRoundToPair(settings: TournamentSettings, allMatches: Match[]): number | null {
  if (settings.pairingAlgorithm !== "fide-swiss") return null
  const planned = settings.plannedSwissRounds ?? 1
  const last = settings.swissLastCompletedRound ?? 0
  const next = last + 1
  if (next > planned) return null
  const inRound = allMatches.filter((m) => m.swissRound === next)
  if (inRound.some((m) => !m.result?.completed)) return null
  if (inRound.length > 0) return null
  return next
}

export function maybeAdvanceSwissLastCompletedRound(
  settings: TournamentSettings,
  allMatches: Match[],
): TournamentSettings {
  if (settings.pairingAlgorithm !== "fide-swiss") return settings
  const planned = settings.plannedSwissRounds ?? 1
  let completed = 0
  for (let r = 1; r <= planned; r++) {
    const inRound = allMatches.filter((m) => m.swissRound === r)
    if (inRound.length === 0) break
    if (inRound.every((m) => m.result?.completed)) completed = r
    else break
  }
  return { ...settings, swissLastCompletedRound: completed }
}

function pickByeRecipient(sortedByScore: Player[]): Player {
  const eligible = sortedByScore.filter((p) => !p.receivedPairingBye && !p.receivedForfeitWin)
  const pool = eligible.length > 0 ? eligible : sortedByScore
  return pool[pool.length - 1]!
}

function pairPlayMatches(
  pool: Player[],
  historical: Match[],
  settings: TournamentSettings,
  round: number,
  maxTables: number,
): Match[] {
  const remaining = [...pool]
  const matches: Match[] = []
  let table = 1
  const capMode = settings.swissLastRoundColorRelax && round === (settings.plannedSwissRounds ?? 1) ? "relaxed" : "strict"
  const longestWait = new Set(pool.map((p) => p.id))
  const priority = settings.colorBalancePriority ?? "high"

  while (remaining.length >= 2 && matches.length < maxTables) {
    const a = remaining.shift()!
    let bi = remaining.findIndex((p) => !hasPlayedEachOther(a, p, historical))
    if (bi < 0) bi = 0
    const b = remaining.splice(bi, 1)[0]!
    const orient =
      bestOrientationForPair(a, b, priority, capMode, longestWait) ??
      bestOrientationForPair(a, b, priority, "relaxed", longestWait) ?? {
        whitePlayer: a,
        blackPlayer: b,
        cost: 0,
      }
    const id = `swiss-r${round}-${orient.whitePlayer.id}-${orient.blackPlayer.id}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    matches.push({
      id,
      player1: orient.whitePlayer,
      player2: orient.blackPlayer,
      swissRound: round,
      matchKind: "play",
      tableNumber: table++,
      startTime: Date.now(),
    })
  }
  return matches
}

export function createSwissPairingsForRound(
  availablePlayers: Player[],
  allHistoricalMatches: Match[],
  settings: TournamentSettings,
  maxTables: number,
): Match[] {
  const round = (settings.swissLastCompletedRound ?? 0) + 1
  const planned = settings.plannedSwissRounds ?? 1
  if (round > planned) return []

  let pool = availablePlayers.filter((p) => !p.hasLeft && !p.paused)
  pool = [...pool].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

  if (pool.length < 1) return []

  const playSlotsNeeded = Math.floor(pool.length / 2)
  if (maxTables < playSlotsNeeded) return []

  let byePlayer: Player | null = null
  let playPool = pool
  if (pool.length % 2 === 1) {
    byePlayer = pickByeRecipient(pool)
    playPool = pool.filter((p) => p.id !== byePlayer!.id)
  }

  const playMatches = pairPlayMatches(playPool, allHistoricalMatches, settings, round, maxTables)
  if (playMatches.length < playSlotsNeeded) return []

  const out: Match[] = [...playMatches]
  if (byePlayer) {
    const now = Date.now()
    const byeMatch: Match = {
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
    }
    out.push(byeMatch)
  }
  return out
}

export const fideSwissAlgorithm: PairingAlgorithm = {
  id: "fide-swiss",
  name: "Swiss (FIDE-style)",
  description: "Round-based Swiss pairings; use the Swiss console to pair each round",

  createPairings(
    availablePlayers: Player[],
    allHistoricalMatches: Match[],
    settings: TournamentSettings,
    maxMatches?: number,
    _totalPlayers?: number,
  ): Match[] {
    const tables = maxMatches ?? Math.ceil(availablePlayers.length / 2)
    return createSwissPairingsForRound(availablePlayers, allHistoricalMatches, settings, tables)
  },

  shouldPair(): boolean {
    return false
  },

  getPollingInterval(): number {
    return 60_000
  },

  validateSettings(settings: TournamentSettings): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const n = settings.plannedSwissRounds ?? 0
    if (n < 1) errors.push("Planned Swiss rounds must be at least 1")
    return { valid: errors.length === 0, errors }
  },
}

export function applyPairingByeToPlayers(byeMatch: Match, players: Player[], settings: TournamentSettings): Player[] {
  if (!isPairingByeMatch(byeMatch) || !byeMatch.result?.completed) return players
  const pid = byeMatch.player1.id
  const swiss = settings.pairingAlgorithm === "fide-swiss"
  return players.map((p) => {
    if (p.id !== pid) return p
    const pts = calculatePointsFromSettings(true, false, p.streak, settings)
    return {
      ...p,
      score: p.score + pts,
      gamesPlayed: p.gamesPlayed + 1,
      streak: swiss ? 0 : p.streak + 1,
      gameResults: [...p.gameResults, "W"],
      opponentIds: [...p.opponentIds, PAIRING_BYE_PLAYER_ID],
      pointsEarned: [...(p.pointsEarned ?? []), pts],
      tableNumbers: [...(p.tableNumbers ?? []), 0],
      receivedPairingBye: true,
    }
  })
}

export function getSwissPairingBlockReason(input: {
  settings: TournamentSettings
  players: Player[]
  hasVenue: boolean
  tableSlots: number
  allMatches: Match[]
}): string | null {
  const { settings, players, hasVenue, tableSlots, allMatches } = input
  if (settings.pairingAlgorithm !== "fide-swiss") return null
  const planned = settings.plannedSwissRounds ?? 1
  const last = settings.swissLastCompletedRound ?? 0
  if (last >= planned) return "swiss.blockAllRoundsComplete"

  const next = last + 1
  const inNext = allMatches.filter((m) => m.swissRound === next)
  if (inNext.some((m) => !m.result?.completed)) return "swiss.blockFinishCurrentRound"

  const nextR = nextSwissRoundToPair(settings, allMatches)
  if (nextR === null) return "swiss.blockUnknown"

  const active = players.filter((p) => !p.hasLeft && !p.paused)
  const eligible = active.filter((p) => !hasVenue || p.checkedInAt != null)
  if (active.length >= 2 && eligible.length === 0) return "swiss.blockCheckIn"

  if (eligible.length < 2) return "swiss.blockNeedTwoPlayers"

  const needTables = Math.ceil(eligible.length / 2)
  if (tableSlots < needTables) return "swiss.blockNotEnoughTables"

  return null
}
