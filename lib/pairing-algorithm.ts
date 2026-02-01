import type { Player, Match } from "./types"

/**
 * Improved arena tournament pairing algorithm based on concepts from:
 * https://github.com/capawhite/pairing-algorithms
 *
 * Strategy:
 * 1. Score all possible pairings using multiple factors
 * 2. Greedily select best pairings to maximize match quality
 * 3. Prioritize avoiding recent rematches
 * 4. Match similar skill levels when possible
 * 5. Prioritize players waiting longest
 * 6. Balance piece colors (avoid too many whites/blacks in a row)
 */

interface PairingScore {
  pairing: [Player, Player]
  score: number
  scoreDiff: number
  recentRematch: boolean
  rematchLevel: "none" | "old" | "recent" | "very-recent" // added to track color balance
  colorImbalance: number // added to track color balance
}

export function pairPlayers(availablePlayers: Player[], allHistoricalMatches: Match[], maxMatches?: number): Match[] {
  console.log("[v0] pairPlayers called with:", {
    availableCount: availablePlayers.length,
    availableNames: availablePlayers.map((p) => p.name),
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
  const isSaturated = saturationRatio >= 0.9 // 90%+ completion means tournament is saturated

  console.log("[v0] Tournament saturation:", {
    uniquePairingsPlayed,
    maxPossibleUniquePairings,
    saturationRatio: `${(saturationRatio * 100).toFixed(1)}%`,
    isSaturated,
  })

  const allOpponents = new Map<string, Set<string>>()
  const recentOpponents = new Map<string, Set<string>>() // Last 5 rounds
  const veryRecentOpponents = new Map<string, Set<string>>() // Last 3 rounds

  availablePlayers.forEach((p) => {
    allOpponents.set(p.id, new Set<string>())
    recentOpponents.set(p.id, new Set<string>())
    veryRecentOpponents.set(p.id, new Set<string>())
  })

  // Track all historical matches with recency levels
  const totalMatches = allHistoricalMatches.length
  allHistoricalMatches.forEach((match, index) => {
    const matchRecency = totalMatches - index // How recent (higher = more recent)

    const p1Opponents = allOpponents.get(match.player1.id)
    const p2Opponents = allOpponents.get(match.player2.id)

    if (p1Opponents) p1Opponents.add(match.player2.id)
    if (p2Opponents) p2Opponents.add(match.player1.id)

    // Last 3 matches
    if (matchRecency <= 3) {
      const p1VeryRecent = veryRecentOpponents.get(match.player1.id)
      const p2VeryRecent = veryRecentOpponents.get(match.player2.id)
      if (p1VeryRecent) p1VeryRecent.add(match.player2.id)
      if (p2VeryRecent) p2VeryRecent.add(match.player1.id)
    }

    // Last 10 matches
    if (matchRecency <= 10) {
      const p1Recent = recentOpponents.get(match.player1.id)
      const p2Recent = recentOpponents.get(match.player2.id)
      if (p1Recent) p1Recent.add(match.player2.id)
      if (p2Recent) p2Recent.add(match.player1.id)
    }
  })

  const possiblePairings = generatePairingScores(availablePlayers, allOpponents, recentOpponents, veryRecentOpponents)

  let pairingsToUse: PairingScore[]

  if (isSaturated) {
    console.log("[v0] Tournament saturated - allowing all pairings including rematches")
    pairingsToUse = possiblePairings // Use all pairings, including very recent rematches
  } else {
    pairingsToUse = possiblePairings.filter((p) => p.rematchLevel === "none")

    if (pairingsToUse.length === 0) {
      console.log("[v0] No new pairings available, allowing older rematches...")
      pairingsToUse = possiblePairings.filter((p) => p.rematchLevel !== "very-recent")
    }

    if (pairingsToUse.length === 0) {
      console.warn("[v0] WARNING: Only recent rematches available! Tournament may be nearing completion.")
      pairingsToUse = possiblePairings
    }
  }

  if (pairingsToUse.length === 0) return []

  const bestMatches = findBestPairingSubset(pairingsToUse, maxMatches)

  console.log("[v0] Best matches found:", {
    matchCount: bestMatches.length,
    matches: bestMatches.map((m) => `${m.player1.name} vs ${m.player2.name}`),
  })

  return bestMatches
}

/**
 * Find the best subset of pairings that maximizes total score
 * This allows some players to wait if it means better matches for others
 */
function findBestPairingSubset(pairings: PairingScore[], maxMatches?: number): Match[] {
  if (pairings.length === 0) return []

  let bestMatches: Match[] = []
  let bestTotalScore = Number.POSITIVE_INFINITY

  // Respect maxMatches limit if provided
  const maxPossibleMatches = maxMatches ?? Math.floor(pairings.length / 2)

  // Try different numbers of matches, prioritizing more matches but allowing fewer if better quality
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

    // Accept this subset if:
    // 1. No matches found yet, or
    // 2. Total score is significantly better (more than 50% improvement per match), or
    // 3. We have 2+ matches and score is reasonable
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

/**
 * Greedily select up to targetMatches number of pairings
 */
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
  recentOpponents: Map<string, Set<string>>,
  veryRecentOpponents: Map<string, Set<string>>,
): PairingScore[] {
  const pairings: PairingScore[] = []

  const avgGamesPlayed = players.reduce((sum, p) => sum + p.gamesPlayed, 0) / players.length

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const p1 = players[i]
      const p2 = players[j]

      const scoreDiff = Math.abs(p1.score - p2.score)

      const hasPlayedVeryRecently = veryRecentOpponents.get(p1.id)?.has(p2.id) ?? false
      const hasPlayedRecently = recentOpponents.get(p1.id)?.has(p2.id) ?? false
      const hasPlayedBefore = allOpponents.get(p1.id)?.has(p2.id) ?? false

      let rematchLevel: "none" | "old" | "recent" | "very-recent"
      let rematchPenalty = 0

      if (hasPlayedVeryRecently) {
        rematchLevel = "very-recent"
        rematchPenalty = 10000 // Virtually impossible
      } else if (hasPlayedRecently) {
        rematchLevel = "recent"
        rematchPenalty = 5000 // Strongly discouraged
      } else if (hasPlayedBefore) {
        rematchLevel = "old"
        rematchPenalty = 1000 // Discouraged but acceptable
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

/**
 * Calculate a player's color balance
 * Returns: (number of whites) - (number of blacks)
 * Positive = more whites, Negative = more blacks, 0 = balanced
 */
function calculateColorBalance(player: Player): number {
  if (!player.pieceColors || player.pieceColors.length === 0) return 0

  const whites = player.pieceColors.filter((c) => c === "white").length
  const blacks = player.pieceColors.filter((c) => c === "black").length

  return whites - blacks
}
