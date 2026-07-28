import type { Player } from "@/lib/types"

export type RematchSummary = {
  players: string
  count: number
}

/** Count rematch frequency across player opponent histories. */
export function analyzeRematches(players: Player[]): {
  uniquePairings: number
  rematches: RematchSummary[]
} {
  const pairings = new Map<string, number>()

  players.forEach((player) => {
    player.opponentIds.forEach((opponentId) => {
      const pair = [player.id, opponentId].sort().join(" vs ")
      pairings.set(pair, (pairings.get(pair) || 0) + 1)
    })
  })

  const uniquePairings = new Map<string, number>()
  pairings.forEach((count, pair) => {
    uniquePairings.set(pair, Math.ceil(count / 2))
  })

  const rematches = Array.from(uniquePairings.entries())
    .filter(([, count]) => count > 1)
    .map(([pair, count]) => {
      const [id1, id2] = pair.split(" vs ")
      const player1 = players.find((p) => p.id === id1)
      const player2 = players.find((p) => p.id === id2)
      return {
        players: `${player1?.name} vs ${player2?.name}`,
        count,
      }
    })

  return { uniquePairings: uniquePairings.size, rematches }
}
