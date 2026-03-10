/**
 * Pure helpers for result submission and agreement logic.
 * Used by submit-result flow and arena; testable without DB.
 */

export type ResultType = "player1-win" | "draw" | "player2-win"

export interface PlayerDataLike {
  userId?: string | null
  user_id?: string
}

/**
 * Parse player data from match (JSON string or object). Supports camelCase and snake_case.
 */
export function parsePlayerData(data: unknown): PlayerDataLike | null {
  if (!data) return null
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as PlayerDataLike
    } catch {
      return null
    }
  }
  return data as PlayerDataLike
}

/**
 * Get the user id from parsed player data (camelCase or snake_case).
 */
export function getPlayerUserId(p: PlayerDataLike | null): string | null {
  return p?.userId ?? p?.user_id ?? null
}

/**
 * Determine if the current user is player1 or player2 based on match player data.
 */
export function getSubmissionSide(
  userId: string,
  player1Data: unknown,
  player2Data: unknown,
): "player1" | "player2" | null {
  const p1 = parsePlayerData(player1Data)
  const p2 = parsePlayerData(player2Data)
  if (getPlayerUserId(p1) === userId) return "player1"
  if (getPlayerUserId(p2) === userId) return "player2"
  return null
}

/**
 * Whether both players have submitted the same result (agreement).
 */
export function submissionsAgree(
  sub1: ResultType | null | undefined,
  sub2: ResultType | null | undefined,
): boolean {
  return (
    sub1 != null &&
    sub2 != null &&
    sub1 === sub2
  )
}

/**
 * Derive winner and draw from agreed submission string and player ids.
 * Used when both player1_submission and player2_submission match.
 */
export function agreedResultToWinner(
  agreedResult: ResultType,
  player1Id: string,
  player2Id: string,
): { winnerId: string | undefined; isDraw: boolean } {
  if (agreedResult === "draw") {
    return { winnerId: undefined, isDraw: true }
  }
  if (agreedResult === "player1-win") {
    return { winnerId: player1Id, isDraw: false }
  }
  return { winnerId: player2Id, isDraw: false }
}

/**
 * Whether there is a conflict: both confirmed but different results.
 */
export function hasSubmissionConflict(
  myResult: ResultType | null | undefined,
  myConfirmed: boolean,
  opponentResult: ResultType | null | undefined,
  opponentConfirmed: boolean,
): boolean {
  return (
    Boolean(myConfirmed && opponentConfirmed && myResult != null && opponentResult != null && myResult !== opponentResult)
  )
}
