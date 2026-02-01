import type { Player, Match, TournamentSettings } from "@/lib/types"
import type { PairingAlgorithm } from "./types"

interface PairingScore {
  pairing: [Player, Player]
  score: number
  scoreDiff: number
  recentRematch: boolean
  rematchLevel: "none" | "old" | "recent" | "very-recent"
  colorImbalance: number
}

/**
 * All vs All Arena Algorithm
 *
 * Strategy:
 * - Waits for a threshold of players to be available before pairing
 * - Pairs all available players at once in rounds
 * - Prioritizes avoiding recent rematches
 * - Matches similar skill levels when possible
 * - Balances piece colors
 */
export const allVsAllAlgorithm: PairingAlgorithm = {
  id: "all-vs-all",
  name: "All vs All (Arena)",
  description: "Traditional arena pairing that creates rounds when enough players are available",

  createPairings(
    availablePlayers: Player[],
    allHistoricalMatches: Match[],
    settings: TournamentSettings,
    maxMatches?: number,
  ): Match[] {
    console.log("[v0] All vs All: Creating pairings", {
      availableCount: availablePlayers.length,
      historicalMatchCount: allHistoricalMatches.length,
      maxMatches: maxMatches ?? "unlimited",
    })

    if (availablePlayers.length < 2) return []

    const totalAvailablePlayers = availablePlayers.length
    const maxPossibleUniquePairings = (totalAvailablePlayers * (totalAvailablePlayers - 1)) / 2
    const uniquePairingsPlayed = new Set(
      allHistoricalMatches.map((m) => {
        const sorted = [m.player1.id, m.player2.id].sort()
        return `${sorted[0]}-${sorted[1]}`
      }),
    ).size
    const saturationRatio = uniquePairingsPlayed / maxPossibleUniquePairings
    const isSaturated = saturationRatio >= 0.9

    console.log("[v0] Tournament saturation:", {
      uniquePairingsPlayed,
      maxPossibleUniquePairings,
      saturationRatio: `${(saturationRatio * 100).toFixed(1)}%`,
      isSaturated,
    })

    const allOpponents = new Map<string, Set<string>>()
    const recentOpponents = new Map<string, Map<string, number>>() // Map opponent to games ago
    const veryRecentOpponents = new Map<string, Map<string, number>>() // Map opponent to games ago

    availablePlayers.forEach((p) => {
      allOpponents.set(p.id, new Set<string>())
      recentOpponents.set(p.id, new Map<string, number>())
      veryRecentOpponents.set(p.id, new Map<string, number>())
    })

    // Build each player's game history in chronological order
    availablePlayers.forEach((player) => {
      if (!player.history || player.history.length === 0) return

      const playerHistory = player.history

      // Iterate through player's history from most recent to oldest
      for (let gameIndex = 0; gameIndex < playerHistory.length; gameIndex++) {
        const game = playerHistory[playerHistory.length - 1 - gameIndex] // Start from most recent
        const opponentId = game.opponentId
        const gamesAgo = gameIndex + 1 // How many games ago this match was for THIS player

        // Track all opponents
        allOpponents.get(player.id)?.add(opponentId)

        // Track very recent opponents (within last 3 games for THIS player)
        if (gamesAgo <= 3) {
          veryRecentOpponents.get(player.id)?.set(opponentId, gamesAgo)
        }

        // Track recent opponents (within last 10 games for THIS player)
        if (gamesAgo <= 10) {
          recentOpponents.get(player.id)?.set(opponentId, gamesAgo)
        }
      }
    })

    const possiblePairings = generatePairingScores(availablePlayers, allOpponents, recentOpponents, veryRecentOpponents)

    let pairingsToUse: PairingScore[]

    if (isSaturated) {
      pairingsToUse = possiblePairings
    } else {
      pairingsToUse = possiblePairings.filter((p) => p.rematchLevel === "none")

      if (pairingsToUse.length === 0) {
        pairingsToUse = possiblePairings.filter((p) => p.rematchLevel !== "very-recent")
      }

      if (pairingsToUse.length === 0) {
        pairingsToUse = possiblePairings
      }
    }

    if (pairingsToUse.length === 0) return []

    const bestMatches = findBestPairingSubset(pairingsToUse, maxMatches)

    return bestMatches
  },

  shouldPair(
    availablePlayers: Player[],
    activeMatches: Match[],
    totalPlayers: number,
    availableTables: number,
  ): boolean {
    // Wait for at least 1/3 of players to be available
    const dynamicThreshold = Math.max(2, Math.floor(totalPlayers / 3))

    const hasEnoughPlayers = availablePlayers.length >= dynamicThreshold
    const hasAvailableTables = availableTables > 0

    return hasEnoughPlayers && hasAvailableTables
  },

  getPollingInterval(): number {
    return 5000 // Check every 5 seconds
  },
}

function findBestPairingSubset(pairings: PairingScore[], maxMatches?: number): Match[] {
  if (pairings.length === 0) return []

  let bestMatches: Match[] = []
  let bestTotalScore = Number.POSITIVE_INFINITY

  const maxPossibleMatches = maxMatches ?? Math.floor(pairings.length / 2)

  for (let targetMatches = maxPossibleMatches; targetMatches >= 1; targetMatches--) {
    const matches = greedySelectPairings(pairings, targetMatches)
    const totalScore = matches.reduce((sum, m) => {
      const scoring = pairings.find(
        (p) =>
          (p.pairing[0].id === m.player1.id && p.pairing[1].id === m.player2.id) ||
          (p.pairing[0].id === m.player2.id && p.pairing[1].id === m.player1.id),
      )
      return sum + (scoring?.score || 0)
    }, 0)

    if (
      bestMatches.length === 0 ||
      totalScore / targetMatches < (bestTotalScore / bestMatches.length) * 0.7 ||
      (targetMatches >= 2 && totalScore / targetMatches < (bestTotalScore / bestMatches.length) * 0.9)
    ) {
      bestMatches = matches
      bestTotalScore = totalScore
    }
  }

  return bestMatches
}

function greedySelectPairings(pairings: PairingScore[], targetMatches: number): Match[] {
  const matches: Match[] = []
  const used = new Set<string>()

  for (const pairing of pairings) {
    if (matches.length >= targetMatches) break

    const [p1, p2] = pairing.pairing
    if (used.has(p1.id) || used.has(p2.id)) continue

    matches.push({
      id: `match-${Date.now()}-${matches.length}`,
      player1: p1,
      player2: p2,
    })

    used.add(p1.id)
    used.add(p2.id)
  }

  return matches
}

function generatePairingScores(
  players: Player[],
  allOpponents: Map<string, Set<string>>,
  recentOpponents: Map<string, Map<string, number>>,
  veryRecentOpponents: Map<string, Map<string, number>>,
): PairingScore[] {
  const pairings: PairingScore[] = []

  const avgGamesPlayed = players.reduce((sum, p) => sum + p.gamesPlayed, 0) / players.length

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const p1 = players[i]
      const p2 = players[j]

      const scoreDiff = Math.abs(p1.score - p2.score)

      const p1VeryRecentGamesAgo = veryRecentOpponents.get(p1.id)?.get(p2.id)
      const p2VeryRecentGamesAgo = veryRecentOpponents.get(p2.id)?.get(p1.id)
      const hasPlayedVeryRecently = p1VeryRecentGamesAgo !== undefined || p2VeryRecentGamesAgo !== undefined

      const p1RecentGamesAgo = recentOpponents.get(p1.id)?.get(p2.id)
      const p2RecentGamesAgo = recentOpponents.get(p2.id)?.get(p1.id)
      const hasPlayedRecently = p1RecentGamesAgo !== undefined || p2RecentGamesAgo !== undefined

      const hasPlayedBefore = allOpponents.get(p1.id)?.has(p2.id) ?? false

      let rematchLevel: "none" | "old" | "recent" | "very-recent"
      let rematchPenalty = 0

      if (hasPlayedVeryRecently) {
        rematchLevel = "very-recent"
        rematchPenalty = 10000
      } else if (hasPlayedRecently) {
        rematchLevel = "recent"
        rematchPenalty = 5000
      } else if (hasPlayedBefore) {
        rematchLevel = "old"
        rematchPenalty = 1000
      } else {
        rematchLevel = "none"
        rematchPenalty = 0
      }

      const p1ColorBalance = calculateColorBalance(p1)
      const p2ColorBalance = calculateColorBalance(p2)

      const colorImbalanceAfterMatch = Math.abs(p1ColorBalance + 1) + Math.abs(p2ColorBalance - 1)
      const colorImbalanceReversed = Math.abs(p1ColorBalance - 1) + Math.abs(p2ColorBalance + 1)

      const bestColorImbalance = Math.min(colorImbalanceAfterMatch, colorImbalanceReversed)
      const shouldReverse = colorImbalanceReversed < colorImbalanceAfterMatch

      const p1Deficit = Math.max(0, avgGamesPlayed - p1.gamesPlayed)
      const p2Deficit = Math.max(0, avgGamesPlayed - p2.gamesPlayed)
      const totalDeficit = p1Deficit + p2Deficit

      let score = scoreDiff * 2
      score += rematchPenalty
      score += bestColorImbalance * 10
      score -= totalDeficit * 20

      pairings.push({
        pairing: shouldReverse ? [p2, p1] : [p1, p2],
        score,
        scoreDiff,
        recentRematch: hasPlayedBefore,
        rematchLevel,
        colorImbalance: bestColorImbalance,
      })
    }
  }

  return pairings.sort((a, b) => a.score - b.score)
}

function calculateColorBalance(player: Player): number {
  if (!player.pieceColors || player.pieceColors.length === 0) return 0

  const whites = player.pieceColors.filter((c) => c === "white").length
  const blacks = player.pieceColors.filter((c) => c === "black").length

  return whites - blacks
}
