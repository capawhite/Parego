"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Player, Match, TournamentSettings } from "@/lib/types"
import { getPairingAlgorithm } from "@/lib/pairing"

interface ComparisonResult {
  round: number
  allVsAllPairings: { player1: string; player2: string; table: number }[]
  balancedStrengthPairings: { player1: string; player2: string; table: number }[]
  diverged: boolean
  divergenceNote?: string
}

export function AlgorithmComparisonPanel({
  tournamentId,
  players,
  matches,
  settings,
}: {
  tournamentId: string
  players: Player[]
  matches: Match[]
  settings: TournamentSettings
}) {
  const [comparing, setComparing] = useState(false)
  const [results, setResults] = useState<ComparisonResult[]>([])

  const runComparison = () => {
    setComparing(true)
    if (process.env.NODE_ENV === "development")
      console.log("[v0] Starting algorithm comparison for tournament:", tournamentId)

    try {
      // Sort matches by their completion order
      const completedMatches = matches
        .filter((m) => m.result?.completed)
        .sort((a, b) => {
          const aTime = a.endTime || 0
          const bTime = b.endTime || 0
          return aTime - bTime
        })

      if (process.env.NODE_ENV === "development")
        console.log("[v0] Found completed matches:", completedMatches.length)

      // Initialize both algorithm states
      const allVsAllAlgo = getPairingAlgorithm("all-vs-all")
      const balancedAlgo = getPairingAlgorithm("balanced-strength")

      const comparisonResults: ComparisonResult[] = []
      let round = 1

      // Simulate both algorithms with the same results
      const allVsAllPlayers = JSON.parse(JSON.stringify(players))
      const balancedPlayers = JSON.parse(JSON.stringify(players))
      const allVsAllMatches: Match[] = []
      const balancedMatches: Match[] = []

      // Group matches by rounds (every N matches where N = number of tables)
      const matchesPerRound = Math.floor(players.length / 2)

      for (let i = 0; i < completedMatches.length; i += matchesPerRound) {
        const roundMatches = completedMatches.slice(i, i + matchesPerRound)

        // Create next pairings with All vs All
        const allVsAllPairings = allVsAllAlgo.createPairings(
          allVsAllPlayers,
          allVsAllMatches,
          { ...settings, pairingAlgorithm: "all-vs-all" },
          {},
        )

        // Create next pairings with Balanced Strength
        const balancedPairings = balancedAlgo.createPairings(
          balancedPlayers,
          balancedMatches,
          {
            ...settings,
            pairingAlgorithm: "balanced-strength",
            baseTimeMinutes: 5,
            incrementSeconds: 3,
          },
          {},
        )

        if (process.env.NODE_ENV === "development")
          console.log(
            `[v0] Round ${round}: All vs All created ${allVsAllPairings.length} pairings, Balanced created ${balancedPairings.length} pairings`,
          )

        // Check if pairings diverged
        const diverged = !pairingsMatch(allVsAllPairings, balancedPairings)

        comparisonResults.push({
          round,
          allVsAllPairings: allVsAllPairings.map((m) => ({
            player1: m.player1.name,
            player2: m.player2.name,
            table: m.table,
          })),
          balancedStrengthPairings: balancedPairings.map((m) => ({
            player1: m.player1.name,
            player2: m.player2.name,
            table: m.table,
          })),
          diverged,
          divergenceNote: diverged ? "Algorithms produced different pairings" : "Algorithms matched",
        })

        // Apply the actual results from this round to both states
        roundMatches.forEach((match) => {
          // Update player scores for both algorithms
          updatePlayerScores(allVsAllPlayers, match)
          updatePlayerScores(balancedPlayers, match)

          // Add to match history
          allVsAllMatches.push(match)
          balancedMatches.push(match)
        })

        round++
      }

      if (process.env.NODE_ENV === "development")
        console.log("[v0] Comparison complete. Results:", comparisonResults)
      setResults(comparisonResults)
    } catch (error) {
      console.error("[v0] Comparison error:", error)
    } finally {
      setComparing(false)
    }
  }

  // Helper function to check if two pairing sets match
  function pairingsMatch(pairings1: Match[], pairings2: Match[]): boolean {
    if (pairings1.length !== pairings2.length) return false

    // Check if all pairings exist in both sets (order doesn't matter)
    return pairings1.every((p1) =>
      pairings2.some(
        (p2) =>
          (p1.player1.id === p2.player1.id && p1.player2.id === p2.player2.id) ||
          (p1.player1.id === p2.player2.id && p1.player2.id === p2.player1.id),
      ),
    )
  }

  // Helper function to update player scores based on match result
  function updatePlayerScores(players: Player[], match: Match) {
    const p1 = players.find((p) => p.id === match.player1.id)
    const p2 = players.find((p) => p.id === match.player2.id)

    if (!p1 || !p2 || !match.result) return

    if (match.result.winner === "white") {
      p1.score += 1
      p1.wins += 1
      p2.losses += 1
    } else if (match.result.winner === "black") {
      p2.score += 1
      p2.wins += 1
      p1.losses += 1
    } else {
      p1.score += 0.5
      p2.score += 0.5
      p1.draws += 1
      p2.draws += 1
    }

    // Update match history
    p1.history.push(match)
    p2.history.push(match)
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-sm">Algorithm Comparison Tool</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Compare how the "All vs All" and "Balanced Strength" algorithms would have paired players differently using
          this tournament's actual results.
        </p>

        <Button
          onClick={runComparison}
          disabled={comparing || matches.length === 0}
          variant="outline"
          size="sm"
          className="w-full bg-transparent"
        >
          {comparing ? "Comparing..." : "Run Algorithm Comparison"}
        </Button>

        {results.length > 0 && (
          <div className="space-y-3 mt-4">
            <h3 className="text-xs font-semibold">Comparison Results:</h3>

            {results.map((result) => (
              <Card key={result.round} className={result.diverged ? "border-orange-500" : "border-green-500/50"}>
                <CardHeader className="p-3">
                  <CardTitle className="text-xs flex items-center justify-between">
                    <span>Round {result.round}</span>
                    {result.diverged ? (
                      <span className="text-orange-500 text-[10px]">⚠ Diverged</span>
                    ) : (
                      <span className="text-green-500 text-[10px]">✓ Matched</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-2">
                  {result.divergenceNote && (
                    <p className="text-[10px] text-muted-foreground italic">{result.divergenceNote}</p>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <h4 className="text-[10px] font-semibold mb-1.5">
                        All vs All ({result.allVsAllPairings.length})
                      </h4>
                      <div className="space-y-0.5">
                        {result.allVsAllPairings.map((pair, idx) => (
                          <div key={idx} className="text-[9px] text-muted-foreground">
                            T{pair.table}: {pair.player1} vs {pair.player2}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-semibold mb-1.5">
                        Balanced Strength ({result.balancedStrengthPairings.length})
                      </h4>
                      <div className="space-y-0.5">
                        {result.balancedStrengthPairings.map((pair, idx) => (
                          <div key={idx} className="text-[9px] text-muted-foreground">
                            T{pair.table}: {pair.player1} vs {pair.player2}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs font-semibold mb-1">Summary:</p>
              <p className="text-[10px] text-muted-foreground">
                Divergence occurred in{" "}
                <span className="font-semibold text-orange-500">{results.filter((r) => r.diverged).length}</span> out of{" "}
                {results.length} rounds
              </p>
              {results.some((r) => r.diverged) && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  First divergence in Round {results.find((r) => r.diverged)?.round}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
