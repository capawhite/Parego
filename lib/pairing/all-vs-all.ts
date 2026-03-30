import type { Player, Match, TournamentSettings } from "@/lib/types"
import type { PairingAlgorithm } from "./types"
import {
  colorCostScoreMultiplier,
  scoreMatchingMultiplier,
  type ColorBalancePriority,
} from "./color-utils"
import { minIdlePlayersBeforePairing } from "./idle-threshold"
import { bestOrientationForPair, type ConsecutiveColorCapMode } from "./color-consecutive-cap"
import { buildPlayerMatchCache, getCacheEntry } from "./pairing-cache"

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
 * Goal: Strive to get everyone to play at least once with every opponent; prefer
 * never-played pairs and avoid very recent rematches; allow rematches when saturated.
 *
 * Strategy:
 * - Waits for a threshold of players to be available before pairing
 * - Pairs all available players at once in rounds
 * - Prioritizes avoiding recent rematches (uses opponentIds for history)
 * - Matches similar skill levels when possible
 * - Balances piece colors
 * - Prefers pairing longer-idle players when the greedy subset leaves one out (odd counts)
 * - Small fields (<=4 players): only pair when no games in progress to avoid instant rematch
 */
export const allVsAllAlgorithm: PairingAlgorithm = {
  id: "all-vs-all",
  name: "All vs All",
  description: "Traditional arena pairing that creates rounds when enough players are available",

  createPairings(
    availablePlayers: Player[],
    allHistoricalMatches: Match[],
    settings: TournamentSettings,
    maxMatches?: number,
    _totalPlayers?: number,
  ): Match[] {
    if (process.env.NODE_ENV === "development")
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

    if (process.env.NODE_ENV === "development")
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

    const avoidN = settings.avoidRecentRematches ?? 3
    const veryRecentWindow = avoidN
    const recentWindow = Math.max(veryRecentWindow * 2, 10)

    // Build opponent history from opponentIds (order played; last index = most recent)
    availablePlayers.forEach((player) => {
      const opponentIds = player.opponentIds ?? []
      if (opponentIds.length === 0) return

      for (let i = opponentIds.length - 1; i >= 0; i--) {
        const opponentId = opponentIds[i]
        const gamesAgo = opponentIds.length - i // 1 = most recent, 2 = one before, etc.

        allOpponents.get(player.id)?.add(opponentId)
        if (gamesAgo <= veryRecentWindow) {
          veryRecentOpponents.get(player.id)?.set(opponentId, gamesAgo)
        }
        if (gamesAgo <= recentWindow) {
          recentOpponents.get(player.id)?.set(opponentId, gamesAgo)
        }
      }
    })

    const nowMs = Date.now()
    const cache = buildPlayerMatchCache(allHistoricalMatches)
    const poolMinJoined = Math.min(...availablePlayers.map((p) => p.joinedAt))

    const idleDurationByPlayer = new Map<string, number>()
    let maxIdleDur = -1
    for (const p of availablePlayers) {
      const entry = getCacheEntry(cache, p.id)
      const idleStart = entry.lastGameEndMs != null ? entry.lastGameEndMs : Math.min(p.joinedAt, poolMinJoined)
      const d = Math.max(0, nowMs - idleStart)
      idleDurationByPlayer.set(p.id, d)
      if (d > maxIdleDur) maxIdleDur = d
    }
    const longestWaitIds = new Set<string>()
    for (const p of availablePlayers) {
      if (idleDurationByPlayer.get(p.id) === maxIdleDur) longestWaitIds.add(p.id)
    }

    const buildForRematchFilter = (capMode: ConsecutiveColorCapMode) => {
      const raw = generatePairingScores(
        availablePlayers,
        allOpponents,
        recentOpponents,
        veryRecentOpponents,
        settings,
        capMode,
        longestWaitIds,
        idleDurationByPlayer,
      )
      if (isSaturated) return raw
      let filtered = raw.filter((p) => p.rematchLevel === "none")
      if (filtered.length === 0) {
        filtered = raw.filter((p) => p.rematchLevel !== "very-recent")
      }
      if (filtered.length === 0 && settings.allowRematchToReduceWait) {
        filtered = raw
      }
      return filtered
    }

    let pairingsToUse = buildForRematchFilter("strict")
    let bestMatches = findBestPairingSubset(pairingsToUse, maxMatches)

    if (bestMatches.length === 0 && availablePlayers.length >= 2) {
      pairingsToUse = buildForRematchFilter("relaxed")
      bestMatches = findBestPairingSubset(pairingsToUse, maxMatches)
    }

    if (bestMatches.length === 0 && availablePlayers.length >= 2) {
      pairingsToUse = buildForRematchFilter("none")
      bestMatches = findBestPairingSubset(pairingsToUse, maxMatches)
    }

    return bestMatches
  },

  shouldPair(
    availablePlayers: Player[],
    activeMatches: Match[],
    totalPlayers: number,
    availableTables: number,
    settings: TournamentSettings,
    _allHistoricalMatches: Match[],
  ): boolean {
    // Small field: only pair when no games in progress so we can avoid immediate rematches
    const SMALL_FIELD_MAX = 4
    if (totalPlayers <= SMALL_FIELD_MAX && activeMatches.length > 0) return false

    const dynamicThreshold = minIdlePlayersBeforePairing(totalPlayers, settings)
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

  const scoreByPairKey = new Map<string, number>()
  for (const p of pairings) {
    const key = p.pairing[0].id <= p.pairing[1].id
      ? `${p.pairing[0].id}\0${p.pairing[1].id}`
      : `${p.pairing[1].id}\0${p.pairing[0].id}`
    scoreByPairKey.set(key, p.score)
  }

  let bestMatches: Match[] = []
  let bestTotalScore = Number.POSITIVE_INFINITY

  const maxPossibleMatches = maxMatches ?? Math.floor(pairings.length / 2)

  for (let targetMatches = maxPossibleMatches; targetMatches >= 1; targetMatches--) {
    const matches = greedySelectPairings(pairings, targetMatches)
    const totalScore = matches.reduce((sum, m) => {
      const key = m.player1.id <= m.player2.id
        ? `${m.player1.id}\0${m.player2.id}`
        : `${m.player2.id}\0${m.player1.id}`
      return sum + (scoreByPairKey.get(key) ?? 0)
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
  settings: TournamentSettings,
  capMode: ConsecutiveColorCapMode,
  longestWaitIds: Set<string>,
  idleDurationByPlayer: Map<string, number>,
): PairingScore[] {
  const pairings: PairingScore[] = []

  const avgGamesPlayed = players.reduce((sum, p) => sum + p.gamesPlayed, 0) / players.length
  const colorPriority: ColorBalancePriority = settings.colorBalancePriority ?? "high"
  const colorMult = colorCostScoreMultiplier(colorPriority)
  const strictMult = scoreMatchingMultiplier(settings.scoreMatchingStrictness ?? "normal")

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

      const oriented = bestOrientationForPair(p1, p2, colorPriority, capMode, longestWaitIds)
      if (!oriented) continue

      const { cost: colorCost, whitePlayer, blackPlayer } = oriented

      const p1Deficit = Math.max(0, avgGamesPlayed - p1.gamesPlayed)
      const p2Deficit = Math.max(0, avgGamesPlayed - p2.gamesPlayed)
      const totalDeficit = p1Deficit + p2Deficit

      let score = scoreDiff * strictMult
      score += rematchPenalty
      score += colorCost * colorMult
      score -= totalDeficit * 20
      // Prefer pairs that include longer-waiting players (odd-field sit-out fairness)
      const minPairIdle = Math.min(
        idleDurationByPlayer.get(whitePlayer.id) ?? 0,
        idleDurationByPlayer.get(blackPlayer.id) ?? 0,
      )
      score -= minPairIdle * 0.001

      pairings.push({
        pairing: [whitePlayer, blackPlayer],
        score,
        scoreDiff,
        recentRematch: hasPlayedBefore,
        rematchLevel,
        colorImbalance: colorCost,
      })
    }
  }

  return pairings.sort((a, b) => a.score - b.score)
}
