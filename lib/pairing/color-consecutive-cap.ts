import type { Player } from "@/lib/types"
import {
  fixedOrientationCost,
  sameColorTailStreak,
  type ColorBalancePriority,
  type PieceColor,
} from "./color-utils"

export type ConsecutiveColorCapMode = "strict" | "relaxed" | "none"

/** True if assigning `assigned` would create a third consecutive same color. */
export function wouldAssignThirdConsecutiveSameColor(pieceColors: PieceColor[], assigned: PieceColor): boolean {
  if (!pieceColors.length) return false
  const { color: tail, length } = sameColorTailStreak(pieceColors)
  return tail === assigned && length >= 2
}

export function orientationStrictCapOk(whiteP: Player, blackP: Player): boolean {
  const w = (whiteP.pieceColors ?? []) as PieceColor[]
  const b = (blackP.pieceColors ?? []) as PieceColor[]
  return (
    !wouldAssignThirdConsecutiveSameColor(w, "white") && !wouldAssignThirdConsecutiveSameColor(b, "black")
  )
}

export function capViolatorIdsForOrientation(whiteP: Player, blackP: Player): Set<string> {
  const s = new Set<string>()
  const w = (whiteP.pieceColors ?? []) as PieceColor[]
  const b = (blackP.pieceColors ?? []) as PieceColor[]
  if (wouldAssignThirdConsecutiveSameColor(w, "white")) s.add(whiteP.id)
  if (wouldAssignThirdConsecutiveSameColor(b, "black")) s.add(blackP.id)
  return s
}

/** Violations allowed only if every violator is among the longest-waiting idle players. */
export function orientationRelaxedCapOk(
  whiteP: Player,
  blackP: Player,
  longestWaitIds: Set<string>,
): boolean {
  const v = capViolatorIdsForOrientation(whiteP, blackP)
  if (v.size === 0) return true
  for (const id of v) {
    if (!longestWaitIds.has(id)) return false
  }
  return true
}

function orientationKey(whiteP: Player, blackP: Player): string {
  return `${whiteP.id}\0${blackP.id}`
}

/**
 * Best white/black for this pair under cap mode. Tries both orientations; null if neither fits.
 */
export function bestOrientationForPair(
  a: Player,
  b: Player,
  priority: ColorBalancePriority,
  mode: ConsecutiveColorCapMode,
  longestWaitIds: Set<string>,
): { whitePlayer: Player; blackPlayer: Player; cost: number } | null {
  const candidates: { whitePlayer: Player; blackPlayer: Player; cost: number }[] = []

  const tryOne = (white: Player, black: Player) => {
    if (mode === "strict") {
      if (!orientationStrictCapOk(white, black)) return
    } else if (mode === "relaxed") {
      if (!orientationRelaxedCapOk(white, black, longestWaitIds)) return
    }
    candidates.push({
      whitePlayer: white,
      blackPlayer: black,
      cost: fixedOrientationCost(white, black, priority),
    })
  }

  tryOne(a, b)
  tryOne(b, a)

  if (candidates.length === 0) return null

  candidates.sort((x, y) => {
    if (x.cost !== y.cost) return x.cost - y.cost
    return orientationKey(x.whitePlayer, x.blackPlayer).localeCompare(
      orientationKey(y.whitePlayer, y.blackPlayer),
    )
  })

  return candidates[0]
}
