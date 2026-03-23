import type { Player, Match, TournamentSettings } from "@/lib/types"
import { getPairingAlgorithm } from "@/lib/pairing"

interface ComparisonResult {
  round: number
  allVsAllPairings: { player1: string; player2: string; table: number }[]
  balancedStrengthPairings: { player1: string; player2: string; table: number }[]
  diverged: boolean
  divergenceNote?: string
}

export async function compareAlgorithms(
  tournamentId: string,
  players: Player[],
  matches: Match[],
  settings: TournamentSettings,
): Promise<ComparisonResult[]> {
  const results: ComparisonResult[] = []

  console.log("[v0] Starting algorithm comparison for tournament:", tournamentId)
  console.log("[v0] Total players:", players.length)
  console.log("[v0] Total matches:", matches.length)

  // Sort matches by their creation order (assuming they have startTime or id order)
  const sortedMatches = [...matches].sort((a, b) => {
    if (a.startTime && b.startTime) {
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    }
    return 0
  })

  // Group matches into rounds (matches that started around the same time)
  const rounds: Match[][] = []
  let currentRound: Match[] = []
  let lastStartTime: Date | null = null

  for (const match of sortedMatches) {
    if (!match.startTime) continue

    const matchStartTime = new Date(match.startTime)

    if (lastStartTime && matchStartTime.getTime() - lastStartTime.getTime() > 60000) {
      // New round if more than 1 minute gap
      if (currentRound.length > 0) {
        rounds.push([...currentRound])
        currentRound = []
      }
    }

    currentRound.push(match)
    lastStartTime = matchStartTime
  }

  if (currentRound.length > 0) {
    rounds.push(currentRound)
  }

  console.log("[v0] Organized into", rounds.length, "rounds")

  // Simulate both algorithms
  const allVsAllPlayers = players.map((p) => ({ ...p }))
  const balancedStrengthPlayers = players.map((p) => ({ ...p }))
  const allVsAllMatches: Match[] = []
  const balancedStrengthMatches: Match[] = []

  const allVsAllAlgo = getPairingAlgorithm("all-vs-all")
  const balancedStrengthAlgo = getPairingAlgorithm("balanced-strength")

  const maxPairingsPerRound = Math.max(1, Math.floor(players.length / 2))

  const balancedSettings = {
    ...settings,
    pairingAlgorithm: "balanced-strength" as const,
    baseTimeMinutes: settings.baseTimeMinutes || 5,
    incrementSeconds: settings.incrementSeconds || 3,
  }

  for (let roundIndex = 0; roundIndex < rounds.length; roundIndex++) {
    const actualRound = rounds[roundIndex]

    console.log(`[v0] === Round ${roundIndex + 1} ===`)
    console.log("[v0] Actual matches in this round:", actualRound.length)

    // Get pairings from All vs All
    const allVsAllPairings = allVsAllAlgo.createPairings(
      allVsAllPlayers,
      allVsAllMatches,
      { ...settings, pairingAlgorithm: "all-vs-all" },
      maxPairingsPerRound,
    )

    // Get pairings from Balanced Strength
    const balancedStrengthPairings = balancedStrengthAlgo.createPairings(
      balancedStrengthPlayers,
      balancedStrengthMatches,
      balancedSettings,
      maxPairingsPerRound,
    )

    console.log("[v0] All vs All would create:", allVsAllPairings.length, "matches")
    console.log("[v0] Balanced Strength would create:", balancedStrengthPairings.length, "matches")

    // Compare pairings
    const allVsAllPairs = allVsAllPairings.map((m) => ({
      player1: m.player1.name,
      player2: m.player2.name,
      table: m.tableNumber ?? 0,
    }))

    const balancedStrengthPairs = balancedStrengthPairings.map((m) => ({
      player1: m.player1.name,
      player2: m.player2.name,
      table: m.tableNumber ?? 0,
    }))

    // Check if pairings diverged
    const diverged = !pairingsMatch(allVsAllPairs, balancedStrengthPairs)

    let divergenceNote: string | undefined
    if (diverged) {
      divergenceNote = `All vs All created ${allVsAllPairs.length} matches, Balanced Strength created ${balancedStrengthPairs.length} matches. Different player pairings.`
    }

    results.push({
      round: roundIndex + 1,
      allVsAllPairings: allVsAllPairs,
      balancedStrengthPairings: balancedStrengthPairs,
      diverged,
      divergenceNote,
    })

    // Apply the actual round results to both simulations
    for (const match of actualRound) {
      if (!match.result?.completed) continue

      // Update All vs All simulation
      updatePlayersWithResult(allVsAllPlayers, match)
      allVsAllMatches.push({ ...match })

      // Update Balanced Strength simulation
      updatePlayersWithResult(balancedStrengthPlayers, match)
      balancedStrengthMatches.push({ ...match })
    }
  }

  return results
}

function pairingsMatch(
  pairs1: { player1: string; player2: string }[],
  pairs2: { player1: string; player2: string }[],
): boolean {
  if (pairs1.length !== pairs2.length) return false

  const normalize = (p1: string, p2: string) => {
    return [p1, p2].sort().join("|")
  }

  const set1 = new Set(pairs1.map((p) => normalize(p.player1, p.player2)))
  const set2 = new Set(pairs2.map((p) => normalize(p.player1, p.player2)))

  if (set1.size !== set2.size) return false

  for (const pair of set1) {
    if (!set2.has(pair)) return false
  }

  return true
}

function updatePlayersWithResult(players: Player[], match: Match) {
  const player1 = players.find((p) => p.id === match.player1.id)
  const player2 = players.find((p) => p.id === match.player2.id)

  if (!player1 || !player2 || !match.result?.completed) return

  const { winnerId, isDraw } = match.result
  if (isDraw) {
    player1.score += 0.5
    player2.score += 0.5
  } else if (winnerId === player1.id) {
    player1.score += 1
  } else if (winnerId === player2.id) {
    player2.score += 1
  }
}
