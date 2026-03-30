/**
 * Pure helpers for result submission logic.
 * Used by submit-result flow; testable without DB.
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

function getPlayerUserId(p: PlayerDataLike | null): string | null {
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
