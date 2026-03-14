import type { Player, Match, TournamentSettings } from "@/lib/types"
import type { PairingAlgorithm } from "./types"

/**
 * Balanced Strength Arena Algorithm
 *
 * Goal: Prefer similar strength (table/rank) but not at the expense of never playing;
 * table range expands with wait time so pairing stays possible.
 *
 * Strategy:
 * - Players are assigned to table ranges based on their ranking
 * - Pairs immediately when 2 players waiting for same table
 * - Table ranges expand progressively with wait time
 * - Rewards longer games, penalizes quick games with wait time
 */

interface PlayerWithWaitData extends Player {
  waitingSince: number // When player became available
  lastMatchDuration?: number // Duration of last match in ms
  lastMatchResult?: "W" | "D" | "L" // Result of last match
  tableRange: number[] // Current range of tables player is waiting for
  optimalTable: number // Mo - optimal table for this player
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
  ): Match[] {
    const totalActive = totalPlayers ?? availablePlayers.length
    const rematchAvoidCount = getRematchAvoidCount(totalActive)

    const J = availablePlayers.length + allHistoricalMatches.filter((m) => !m.result?.completed).length // Total players
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

    if (availablePlayers.length === 1) {
      if (process.env.NODE_ENV === "development")
        console.log("[v0] Single player waiting - will be paired immediately when next player finishes")
      return []
    }

    if (availablePlayers.length < 2) {
      return []
    }

    // Calculate P (table-to-player ratio)
    const P = (2 * M) / J

    const now = Date.now()

    // Rank players by their current standing
    const rankedPlayers = rankPlayers(availablePlayers)

    // Calculate wait data for each player
    const playersWithWaitData: PlayerWithWaitData[] = rankedPlayers.map((player, index) => {
      const C = index + 1 // Ranking position (1-based)
      const Mo = (C / 2) * P // Optimal table

      // Get last match duration
      const lastMatch = allHistoricalMatches
        .filter((m) => (m.player1.id === player.id || m.player2.id === player.id) && m.result?.completed)
        .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))[0]

      let waitingSince: number

      if (!lastMatch) {
        // Player has never played a match - they've been waiting since they joined
        waitingSince = player.joinedAt
      } else {
        // Player finished a match - calculate T1 wait time
        const Dp = lastMatch.startTime && lastMatch.endTime ? lastMatch.endTime - lastMatch.startTime : Tp
        const lastResult = player.gameResults[player.gameResults.length - 1]

        // Calculate T1 (initial wait time)
        let T1 = (Tp / 20) * (Tp / Dp)
        if (lastResult === "D") {
          T1 = T1 * (Tp / Dp) // Reward long draws, penalize short draws
        }
        if (T1 > Tp) T1 = Tp // Cap at max game time

        waitingSince = now - T1 // Backdate to account for T1
      }

      const lastResult = player.gameResults[player.gameResults.length - 1]
      const Dp = lastMatch?.startTime && lastMatch?.endTime ? lastMatch.endTime - lastMatch.startTime : Tp

      // Calculate T2 (time interval to expand range)
      const T2 = (Tp * J) / (M * M) / (1 + C / J)

      // Calculate how much time has passed since player became available
      const timeSinceAvailable = now - waitingSince
      const rangeExpansions = Math.floor(timeSinceAvailable / T2)

      // Initial range: [Mo - P, Mo + P], then expand by P each T2 interval.
      // Range expands over wait time so players are not permanently restricted to one strength band.
      const minTable = Math.max(1, Math.floor(Mo - P - rangeExpansions * P))
      const maxTable = Math.min(M, Math.ceil(Mo + P + rangeExpansions * P))

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

    // Build table waiting lists
    const tableWaitingLists: Map<number, PlayerWithWaitData[]> = new Map()
    for (let table = 1; table <= M; table++) {
      tableWaitingLists.set(table, [])
    }

    // Add players to their table waiting lists
    for (const player of playersWithWaitData) {
      for (const table of player.tableRange) {
        const list = tableWaitingLists.get(table) || []
        list.push(player)
        tableWaitingLists.set(table, list)
      }
    }

    // Create pairings: when 2+ players waiting for same table, pair them
    const matches: Match[] = []
    const pairedPlayerIds = new Set<string>()
    const usedTables = new Set<number>()

    // Process tables in order (lower tables = higher ranked players)
    for (let table = 1; table <= M; table++) {
      if (usedTables.has(table)) continue
      if (maxMatches && matches.length >= maxMatches) break

      const waitingList = (tableWaitingLists.get(table) || [])
        .filter((p) => !pairedPlayerIds.has(p.id))
        .sort((a, b) => {
          // First priority: fewest games played
          const aGames = a.gameResults.length
          const bGames = b.gameResults.length
          if (aGames !== bGames) return aGames - bGames

          // Second priority: who waited longest
          return a.waitingSince - b.waitingSince
        })

      if (waitingList.length >= 2) {
        const pair = selectPairWithRematchRule(waitingList, rematchAvoidCount)
        if (!pair) continue

        const [player1, player2] = pair

        // Determine colors based on balance
        const { whitePlayer, blackPlayer } = assignColors(player1, player2, allHistoricalMatches)

        matches.push({
          id: `${whitePlayer.id}-${blackPlayer.id}-${Date.now()}`,
          player1: whitePlayer,
          player2: blackPlayer,
          tableNumber: table,
          startTime: Date.now(), // Record match start time
        })

        pairedPlayerIds.add(player1.id)
        pairedPlayerIds.add(player2.id)
        usedTables.add(table)

        if (process.env.NODE_ENV === "development")
          console.log("[v0] Paired at table", table, ":", whitePlayer.name, "vs", blackPlayer.name)
      }
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
  ): boolean {
    // Pair immediately when 2+ players are available
    // No need to check table availability - completed matches free up tables dynamically
    return availablePlayers.length >= 2
  },

  getPollingInterval(): number {
    return 2000 // Check every 2 seconds for continuous pairing
  },
}

/**
 * Rematch avoidance by active player count:
 * 16+ → avoid last 3 opponents; 10–15 → 2; 6–9 → 1; 2–5 → allow rematches but prefer avoiding immediate.
 */
function getRematchAvoidCount(totalActive: number): number {
  if (totalActive >= 16) return 3
  if (totalActive >= 10) return 2
  if (totalActive >= 6) return 1
  return 0
}

/** Set of opponent IDs from the last n games (order: most recent last). */
function getLastNOpponents(player: Player, n: number): Set<string> {
  const ids = player.opponentIds ?? []
  if (n <= 0) return new Set()
  return new Set(ids.slice(-n))
}

/**
 * Pick the best pair from waitingList that satisfies rematch rules.
 * avoidCount >= 1: only allow pairs that are not in each other's last N opponents; skip if none.
 * avoidCount === 0 (2–5 players): prefer non–immediate rematch; allow rematch if no alternative.
 */
function selectPairWithRematchRule(
  waitingList: PlayerWithWaitData[],
  avoidCount: number,
): [PlayerWithWaitData, PlayerWithWaitData] | null {
  if (waitingList.length < 2) return null

  const avoidSets = new Map<string, Set<string>>()
  for (const p of waitingList) {
    avoidSets.set(p.id, getLastNOpponents(p, avoidCount >= 1 ? avoidCount : 1))
  }

  const isDisallowed = (a: PlayerWithWaitData, b: PlayerWithWaitData) =>
    avoidSets.get(a.id)?.has(b.id) || avoidSets.get(b.id)?.has(a.id)

  // Valid pairs: not in each other's avoid set (for avoidCount >= 1) or any pair (for avoidCount === 0)
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
    if (validPairs.length === 0) return null
    return validPairs[0]
  }

  // 2–5 players: prefer pair that is not an immediate rematch
  const nonRematch = validPairs.find(([a, b]) => !isDisallowed(a, b))
  return nonRematch ?? validPairs[0]
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

/**
 * Assign colors based on color balance and recent history
 */
function assignColors(
  player1: Player,
  player2: Player,
  allMatches: Match[],
): { whitePlayer: Player; blackPlayer: Player } {
  // Calculate color balance (whites - blacks)
  const p1Balance =
    player1.pieceColors.filter((c) => c === "white").length - player1.pieceColors.filter((c) => c === "black").length
  const p2Balance =
    player2.pieceColors.filter((c) => c === "white").length - player2.pieceColors.filter((c) => c === "black").length

  // If different balances, give white to the one with lower balance
  if (p1Balance < p2Balance) {
    return { whitePlayer: player1, blackPlayer: player2 }
  } else if (p2Balance < p1Balance) {
    return { whitePlayer: player2, blackPlayer: player1 }
  }

  // Same balance - check recent history
  const p1Recent = player1.pieceColors[player1.pieceColors.length - 1]
  const p2Recent = player2.pieceColors[player2.pieceColors.length - 1]

  if (p1Recent === "black" && p2Recent !== "black") {
    return { whitePlayer: player1, blackPlayer: player2 }
  } else if (p2Recent === "black" && p1Recent !== "black") {
    return { whitePlayer: player2, blackPlayer: player1 }
  }

  // If still tied, random
  return Math.random() < 0.5
    ? { whitePlayer: player1, blackPlayer: player2 }
    : { whitePlayer: player2, blackPlayer: player1 }
}
