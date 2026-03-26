import type { Player, Match, TournamentSettings } from "@/lib/types"
import type { PairingAlgorithm } from "./types"
import type { ColorBalancePriority } from "./color-utils"
import { minIdlePlayersBeforePairing } from "./idle-threshold"
import { longestWaitingPlayerIds } from "./idle-wait"
import { bestOrientationForPair } from "./color-consecutive-cap"
import {
  arenaWaitClockStartMs,
  filterArenaT1EligiblePlayers,
  lastCompletedMatchForPlayer,
} from "./arena-t1"

/**
 * Balanced Strength Arena Algorithm
 *
 * Goal: Prefer similar strength (table/rank) but not at the expense of never playing;
 * table range expands with wait time so pairing stays possible.
 *
 * Strategy:
 * - Players are assigned to table ranges based on their ranking
 * - Pairs when enough idle players (default ~n/3, configurable) and 2+ at a table
 * - Among rematch-legal pairs, prefers better white/black balance and fewer same-color streaks
 * - Table ranges expand progressively with wait time (T2 step clamped for UX; full-table fallback if no pairs)
 * - ARENACHESS T1: real freeze after each game (eligible only after endTime + T1); wait clock for T2 starts then
 * - Rewards longer games, penalizes quick games via shorter T1 after quick games
 */

interface PlayerWithWaitData extends Player {
  waitingSince: number // When player became available
  lastMatchDuration?: number // Duration of last match in ms
  lastMatchResult?: "W" | "D" | "L" // Result of last match
  tableRange: number[] // Current range of tables player is waiting for
  optimalTable: number // Mo - optimal table for this player
}

/** PDF T2 can be many minutes with long clocks; clamp so table bands overlap within tens of seconds, not hours. */
function clampT2StepMs(rawT2: number): number {
  const minStep = 8_000
  const maxStep = 35_000
  if (!Number.isFinite(rawT2) || rawT2 <= 0) return maxStep
  return Math.min(maxStep, Math.max(minStep, rawT2))
}

function greedyTablePairingsFromWaitData(
  playersWithWaitData: PlayerWithWaitData[],
  eligiblePlayers: Player[],
  M: number,
  maxMatches: number | undefined,
  rematchAvoidCount: number,
  colorPriority: ColorBalancePriority,
  longestWaitIds: Set<string>,
): Match[] {
  const avgGamesPlayed =
    eligiblePlayers.reduce((s, p) => s + p.gameResults.length, 0) / Math.max(1, eligiblePlayers.length)

  const tableWaitingLists: Map<number, PlayerWithWaitData[]> = new Map()
  for (let table = 1; table <= M; table++) {
    tableWaitingLists.set(table, [])
  }

  for (const player of playersWithWaitData) {
    for (const table of player.tableRange) {
      const list = tableWaitingLists.get(table) || []
      list.push(player)
      tableWaitingLists.set(table, list)
    }
  }

  const matches: Match[] = []
  const pairedPlayerIds = new Set<string>()
  const usedTables = new Set<number>()

  for (let table = 1; table <= M; table++) {
    if (usedTables.has(table)) continue
    if (maxMatches && matches.length >= maxMatches) break

    const waitingList = (tableWaitingLists.get(table) || [])
      .filter((p) => !pairedPlayerIds.has(p.id))
      .sort((a, b) => {
        const aGames = a.gameResults.length
        const bGames = b.gameResults.length
        if (aGames !== bGames) return aGames - bGames
        return a.waitingSince - b.waitingSince
      })

    if (waitingList.length >= 2) {
      const oriented = selectOrientedPairWithRematchRule(
        waitingList,
        rematchAvoidCount,
        colorPriority,
        longestWaitIds,
        avgGamesPlayed,
      )
      if (!oriented) continue

      const { whitePlayer, blackPlayer } = oriented

      matches.push({
        id: `${whitePlayer.id}-${blackPlayer.id}-${Date.now()}`,
        player1: whitePlayer,
        player2: blackPlayer,
        tableNumber: table,
        startTime: Date.now(),
      })

      pairedPlayerIds.add(whitePlayer.id)
      pairedPlayerIds.add(blackPlayer.id)
      usedTables.add(table)

      if (process.env.NODE_ENV === "development")
        console.log("[v0] Paired at table", table, ":", whitePlayer.name, "vs", blackPlayer.name)
    }
  }

  return matches
}

export const balancedStrengthAlgorithm: PairingAlgorithm = {
  id: "balanced-strength",
  name: "Arena",
  description: "Dynamic table-based pairing that matches players by strength with progressive range expansion",

  createPairings(
    availablePlayers: Player[],
    allHistoricalMatches: Match[],
    settings: TournamentSettings,
    maxMatches?: number,
    totalPlayers?: number,
    options?: { skipT1?: boolean },
  ): Match[] {
    const totalActive = totalPlayers ?? availablePlayers.length
    const rematchAvoidCount = rematchAvoidCountFromSettings(totalActive, settings.avoidRecentRematches)
    const colorPriority: ColorBalancePriority = settings.colorBalancePriority ?? "high"

    const J = Math.max(1, totalActive) // Total players in tournament (PDF J)
    const M = settings.tableCount || 1 // Number of tables

    // Time controls with defaults
    const Tf = (settings.baseTimeMinutes || 5) * 60 * 1000 // Convert to ms
    const Ta = (settings.incrementSeconds || 0) * 1000 // Convert to ms
    const Tp = Tf * 2 + Ta * 2 * 40 // Max estimated game time (40 moves)

    if (process.env.NODE_ENV === "development")
      console.log("[v0] Balanced Strength: Creating pairings", {
      availableCount: availablePlayers.length,
      totalPlayers: J,
      tables: M,
      Tf,
      Ta,
      Tp,
    })

    const now = Date.now()
    const eligiblePlayers = options?.skipT1
      ? availablePlayers
      : filterArenaT1EligiblePlayers(availablePlayers, allHistoricalMatches, settings, now)

    if (eligiblePlayers.length === 1) {
      if (process.env.NODE_ENV === "development")
        console.log("[v0] Single T1-eligible player waiting - others still in T1 freeze or in games")
      return []
    }

    if (eligiblePlayers.length < 2) {
      return []
    }

    // Calculate P (table-to-player ratio)
    const P = (2 * M) / J

    const longestWaitIds = longestWaitingPlayerIds(eligiblePlayers, allHistoricalMatches, now)

    const rankedPlayers = rankPlayers(eligiblePlayers)

    const buildWaitData = (fullTableRangeOnly: boolean): PlayerWithWaitData[] =>
      rankedPlayers.map((player, index) => {
        const C = index + 1
        const Mo = (C / 2) * P

        const lastMatch = lastCompletedMatchForPlayer(player.id, allHistoricalMatches)
        const waitingSince = arenaWaitClockStartMs(player, allHistoricalMatches, settings)
        const lastResult = player.gameResults[player.gameResults.length - 1]
        const Dp =
          lastMatch?.startTime != null && lastMatch?.endTime != null
            ? lastMatch.endTime - lastMatch.startTime
            : Tp

        const rawT2 = (Tp * J) / (M * M) / (1 + C / J)
        const t2Step = clampT2StepMs(rawT2)
        const timeSinceAvailable = now - waitingSince
        const rangeExpansions = fullTableRangeOnly ? 0 : Math.floor(timeSinceAvailable / t2Step)

        let minTable: number
        let maxTable: number
        if (fullTableRangeOnly) {
          minTable = 1
          maxTable = M
        } else {
          minTable = Math.max(1, Math.floor(Mo - P - rangeExpansions * P))
          maxTable = Math.min(M, Math.ceil(Mo + P + rangeExpansions * P))
        }

        const tableRange: number[] = []
        for (let t = minTable; t <= maxTable; t++) {
          tableRange.push(t)
        }

        return {
          ...player,
          waitingSince,
          lastMatchDuration: Dp,
          lastMatchResult: lastResult,
          tableRange,
          optimalTable: Math.round(Mo),
        }
      })

    let playersWithWaitData = buildWaitData(false)

    if (process.env.NODE_ENV === "development")
      console.log(
        "[v0] Players with wait data:",
        playersWithWaitData.map((p) => ({
          name: p.name,
          rank: rankedPlayers.indexOf(p) + 1,
          optimalTable: p.optimalTable,
          tableRange: p.tableRange,
        })),
      )

    let matches = greedyTablePairingsFromWaitData(
      playersWithWaitData,
      eligiblePlayers,
      M,
      maxMatches,
      rematchAvoidCount,
      colorPriority,
      longestWaitIds,
    )

    if (matches.length === 0 && eligiblePlayers.length >= 2) {
      playersWithWaitData = buildWaitData(true)
      if (process.env.NODE_ENV === "development")
        console.log("[v0] Balanced Strength: fallback full table range (no pairs in banded pass)")
      matches = greedyTablePairingsFromWaitData(
        playersWithWaitData,
        eligiblePlayers,
        M,
        maxMatches,
        rematchAvoidCount,
        colorPriority,
        longestWaitIds,
      )
    }

    if (process.env.NODE_ENV === "development")
      console.log("[v0] Balanced Strength created", matches.length, "matches")
    return matches
  },

  shouldPair(
    availablePlayers: Player[],
    activeMatches: Match[],
    totalPlayers: number,
    availableTables: number,
    settings: TournamentSettings,
    allHistoricalMatches: Match[],
  ): boolean {
    const SMALL_FIELD_MAX = 4
    if (totalPlayers <= SMALL_FIELD_MAX && activeMatches.length > 0) return false

    const threshold = minIdlePlayersBeforePairing(totalPlayers, settings)
    const now = Date.now()
    /** Min idle count applies to T1-eligible players (idle on UI but still in freeze do not count). */
    const eligible = filterArenaT1EligiblePlayers(availablePlayers, allHistoricalMatches, settings, now)

    /** While some games are still going, never require more T1-eligible idlers than are actually idle. */
    const effectiveThreshold =
      activeMatches.length > 0
        ? Math.min(threshold, Math.max(2, availablePlayers.length))
        : threshold

    return eligible.length >= effectiveThreshold && availableTables > 0
  },

  getPollingInterval(): number {
    return 2000 // Check every 2 seconds for continuous pairing
  },
}

/**
 * Uses organizer `avoidRecentRematches` (capped) for fields with 6+ players; small fields use 0 so we only prefer non-immediate rematches.
 */
function rematchAvoidCountFromSettings(totalActive: number, avoidRecentRematches: number | undefined): number {
  if (totalActive <= 5) return 0
  const n = avoidRecentRematches ?? 3
  return Math.max(0, Math.min(10, Math.floor(n)))
}

/** Set of opponent IDs from the last n games (order: most recent last). */
function getLastNOpponents(player: Player, n: number): Set<string> {
  const ids = player.opponentIds ?? []
  if (n <= 0) return new Set()
  return new Set(ids.slice(-n))
}

/**
 * Pick the best pair from waitingList that satisfies rematch rules; progressive color cap (strict → relaxed → none).
 */
function selectOrientedPairWithRematchRule(
  waitingList: PlayerWithWaitData[],
  avoidCount: number,
  colorPriority: ColorBalancePriority,
  longestWaitIds: Set<string>,
  avgGamesPlayed: number,
): { whitePlayer: PlayerWithWaitData; blackPlayer: PlayerWithWaitData } | null {
  if (waitingList.length < 2) return null

  const avoidSets = new Map<string, Set<string>>()
  for (const p of waitingList) {
    avoidSets.set(p.id, getLastNOpponents(p, avoidCount >= 1 ? avoidCount : 1))
  }

  const isDisallowed = (a: PlayerWithWaitData, b: PlayerWithWaitData) =>
    avoidSets.get(a.id)?.has(b.id) || avoidSets.get(b.id)?.has(a.id)

  const validPairs: [PlayerWithWaitData, PlayerWithWaitData][] = []
  for (let i = 0; i < waitingList.length; i++) {
    for (let j = i + 1; j < waitingList.length; j++) {
      const a = waitingList[i]
      const b = waitingList[j]
      if (avoidCount >= 1) {
        if (!isDisallowed(a, b)) validPairs.push([a, b])
      } else {
        validPairs.push([a, b])
      }
    }
  }

  if (avoidCount >= 1) {
    if (validPairs.length === 0) {
      const allPairs: [PlayerWithWaitData, PlayerWithWaitData][] = []
      for (let i = 0; i < waitingList.length; i++) {
        for (let j = i + 1; j < waitingList.length; j++) {
          allPairs.push([waitingList[i], waitingList[j]])
        }
      }
      if (allPairs.length === 0) return null
      return pickBestOrientedPairFromPool(allPairs, colorPriority, longestWaitIds, avgGamesPlayed)
    }
    return pickBestOrientedPairFromPool(validPairs, colorPriority, longestWaitIds, avgGamesPlayed)
  }

  const nonImmediate = validPairs.filter(([a, b]) => !isDisallowed(a, b))
  const pool = nonImmediate.length > 0 ? nonImmediate : validPairs
  return pickBestOrientedPairFromPool(pool, colorPriority, longestWaitIds, avgGamesPlayed)
}

function stablePairKey(a: Player, b: Player): string {
  return a.id <= b.id ? `${a.id}\0${b.id}` : `${b.id}\0${a.id}`
}

function pickBestOrientedPairFromPool(
  pairs: [PlayerWithWaitData, PlayerWithWaitData][],
  colorPriority: ColorBalancePriority,
  longestWaitIds: Set<string>,
  avgGamesPlayed: number,
): { whitePlayer: PlayerWithWaitData; blackPlayer: PlayerWithWaitData } | null {
  if (pairs.length === 0) return null

  for (const mode of ["strict", "relaxed", "none"] as const) {
    let best: {
      whitePlayer: PlayerWithWaitData
      blackPlayer: PlayerWithWaitData
      cost: number
      waitSum: number
      maxGames: number
      gamesDeficit: number
      key: string
    } | null = null

    for (const [a, b] of pairs) {
      const o = bestOrientationForPair(a, b, colorPriority, mode, longestWaitIds)
      if (!o) continue
      const waitSum = a.waitingSince + b.waitingSince
      const key = stablePairKey(a, b)
      const ga = a.gameResults.length
      const gb = b.gameResults.length
      const maxGames = Math.max(ga, gb)
      const gamesDeficit =
        Math.max(0, avgGamesPlayed - ga) + Math.max(0, avgGamesPlayed - gb)
      if (
        !best ||
        o.cost < best.cost ||
        (o.cost === best.cost && waitSum < best.waitSum) ||
        (o.cost === best.cost &&
          waitSum === best.waitSum &&
          maxGames < best.maxGames) ||
        (o.cost === best.cost &&
          waitSum === best.waitSum &&
          maxGames === best.maxGames &&
          gamesDeficit > best.gamesDeficit) ||
        (o.cost === best.cost &&
          waitSum === best.waitSum &&
          maxGames === best.maxGames &&
          gamesDeficit === best.gamesDeficit &&
          key < best.key)
      ) {
        best = {
          whitePlayer: o.whitePlayer as PlayerWithWaitData,
          blackPlayer: o.blackPlayer as PlayerWithWaitData,
          cost: o.cost,
          waitSum,
          maxGames,
          gamesDeficit,
          key,
        }
      }
    }

    if (best) {
      return { whitePlayer: best.whitePlayer, blackPlayer: best.blackPlayer }
    }
  }

  return null
}

/**
 * Rank players by tournament standings
 */
function rankPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    // 1. More points
    if (b.score !== a.score) return b.score - a.score

    // 2. More draws
    const aDraws = a.gameResults.filter((r) => r === "D").length
    const bDraws = b.gameResults.filter((r) => r === "D").length
    if (bDraws !== aDraws) return bDraws - aDraws

    // 3. Fewer losses
    const aLosses = a.gameResults.filter((r) => r === "L").length
    const bLosses = b.gameResults.filter((r) => r === "L").length
    if (aLosses !== bLosses) return aLosses - bLosses

    // 4. Join order (earlier is better)
    return a.joinedAt - b.joinedAt
  })
}

