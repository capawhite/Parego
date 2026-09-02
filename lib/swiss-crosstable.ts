import type { Match, Player } from "@/lib/types"
import { isPairingByeMatch } from "@/lib/pairing/swiss"
import { PAIRING_BYE_PLAYER_ID } from "@/lib/types"

export type SwissCrosstableCell = {
  round: number
  /** Display like "1", "½", "0", "+", "-" (bye), or "—" */
  scoreText: string
  opponentName: string | null
  color: "white" | "black" | null
  isBye: boolean
  isForfeit: boolean
}

export type SwissCrosstableRow = {
  player: Player
  cells: SwissCrosstableCell[]
}

/**
 * Build a player × round Swiss crosstable from completed matches.
 */
export function buildSwissCrosstable(
  players: Player[],
  matches: Match[],
  plannedRounds: number,
): SwissCrosstableRow[] {
  const rounds = Math.max(
    plannedRounds,
    ...matches.map((m) => m.swissRound ?? 0),
    0,
  )
  if (rounds <= 0) return []

  const byPlayerRound = new Map<string, Map<number, SwissCrosstableCell>>()

  const ensure = (playerId: string) => {
    if (!byPlayerRound.has(playerId)) byPlayerRound.set(playerId, new Map())
    return byPlayerRound.get(playerId)!
  }

  for (const match of matches) {
    if (!match.result?.completed) continue
    const round = match.swissRound
    if (round == null || round < 1) continue

    if (isPairingByeMatch(match)) {
      const cell: SwissCrosstableCell = {
        round,
        scoreText: "+",
        opponentName: null,
        color: null,
        isBye: true,
        isForfeit: false,
      }
      ensure(match.player1.id).set(round, cell)
      continue
    }

    const p1Id = match.player1.id
    const p2Id = match.player2.id
    if (p2Id === PAIRING_BYE_PLAYER_ID) continue

    const isDraw = match.result.isDraw
    const winnerId = match.result.winnerId
    const isForfeit = Boolean(match.result.isForfeit)

    const scoreFor = (playerId: string): string => {
      if (isDraw) return "½"
      if (winnerId === playerId) return isForfeit ? "1F" : "1"
      return isForfeit ? "0F" : "0"
    }

    ensure(p1Id).set(round, {
      round,
      scoreText: scoreFor(p1Id),
      opponentName: match.player2.name,
      color: "white",
      isBye: false,
      isForfeit,
    })
    ensure(p2Id).set(round, {
      round,
      scoreText: scoreFor(p2Id),
      opponentName: match.player1.name,
      color: "black",
      isBye: false,
      isForfeit,
    })
  }

  const activePlayers = players.filter((p) => !p.hasLeft || (p.gamesPlayed ?? 0) > 0)
  const sorted = [...activePlayers].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.name.localeCompare(b.name)
  })

  return sorted.map((player) => {
    const roundMap = byPlayerRound.get(player.id) ?? new Map()
    const cells: SwissCrosstableCell[] = []
    for (let r = 1; r <= rounds; r++) {
      cells.push(
        roundMap.get(r) ?? {
          round: r,
          scoreText: "—",
          opponentName: null,
          color: null,
          isBye: false,
          isForfeit: false,
        },
      )
    }
    return { player, cells }
  })
}

/** Group completed matches by Swiss round (descending). */
export function groupCompletedMatchesByRound(matches: Match[]): { round: number; matches: Match[] }[] {
  const map = new Map<number, Match[]>()
  for (const m of matches) {
    if (!m.result?.completed) continue
    const round = m.swissRound
    if (round == null) continue
    const list = map.get(round) ?? []
    list.push(m)
    map.set(round, list)
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([round, roundMatches]) => ({
      round,
      matches: [...roundMatches].sort((a, b) => (a.tableNumber ?? 0) - (b.tableNumber ?? 0)),
    }))
}

export function formatMatchResultShort(match: Match): string {
  if (!match.result?.completed) return "…"
  if (isPairingByeMatch(match)) return "+"
  if (match.result.isDraw) return "½-½"
  const forfeit = match.result.isForfeit ? "F" : ""
  if (match.result.winnerId === match.player1.id) return `1-0${forfeit}`
  return `0-1${forfeit}`
}
