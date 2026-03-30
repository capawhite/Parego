import type { Player } from "@/lib/types"

export type PieceColor = "white" | "black"
export type ColorBalancePriority = "low" | "medium" | "high"

export function colorBalance(pieceColors: PieceColor[]): number {
  if (!pieceColors?.length) return 0
  let whites = 0
  let blacks = 0
  for (const c of pieceColors) {
    if (c === "white") whites++
    else blacks++
  }
  return whites - blacks
}

/** Length of same-color run at end of history; color null if empty. */
export function sameColorTailStreak(pieceColors: PieceColor[]): { color: PieceColor | null; length: number } {
  if (!pieceColors?.length) return { color: null, length: 0 }
  const last = pieceColors[pieceColors.length - 1]
  let len = 0
  for (let i = pieceColors.length - 1; i >= 0 && pieceColors[i] === last; i--) {
    len++
  }
  return { color: last, length: len }
}

function incrementalAssignCost(
  pieceColors: PieceColor[],
  assigned: PieceColor,
  streakWeight: number,
  balanceWeight: number,
): number {
  const bal = colorBalance(pieceColors)
  const { color: tail, length } = sameColorTailStreak(pieceColors)
  const newBal = bal + (assigned === "white" ? 1 : -1)
  let cost = Math.abs(newBal) * balanceWeight
  if (tail === assigned) {
    const nextLen = length + 1
    cost += streakWeight * nextLen * nextLen
  }
  return cost
}

export function pairingOrientationCost(
  whitePlayerColors: PieceColor[],
  blackPlayerColors: PieceColor[],
  streakWeight: number,
  balanceWeight: number,
): number {
  return (
    incrementalAssignCost(whitePlayerColors, "white", streakWeight, balanceWeight) +
    incrementalAssignCost(blackPlayerColors, "black", streakWeight, balanceWeight)
  )
}

function priorityWeights(priority: ColorBalancePriority): { streakWeight: number; balanceWeight: number } {
  const mult = priority === "high" ? 1.5 : priority === "medium" ? 1 : 0.5
  return { streakWeight: 22 * mult, balanceWeight: 4 * mult }
}

/** Cost for a fixed assignment (whiteP plays white, blackP plays black). */
export function fixedOrientationCost(whiteP: Player, blackP: Player, priority: ColorBalancePriority): number {
  const { streakWeight, balanceWeight } = priorityWeights(priority)
  return pairingOrientationCost(
    (whiteP.pieceColors ?? []) as PieceColor[],
    (blackP.pieceColors ?? []) as PieceColor[],
    streakWeight,
    balanceWeight,
  )
}

/** Scalar weight for adding orientation cost into All vs All pairing scores. */
export function colorCostScoreMultiplier(priority: ColorBalancePriority): number {
  const mult = priority === "high" ? 1.5 : priority === "medium" ? 1 : 0.5
  return 10 * mult
}

export function scoreMatchingMultiplier(strictness: "loose" | "normal" | "strict"): number {
  if (strictness === "strict") return 4
  if (strictness === "loose") return 1
  return 2
}
