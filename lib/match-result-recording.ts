/**
 * Client-side idempotency so the same match is not scored twice (Realtime + submit).
 */
export function beginMatchResultRecording(matchId: string, recorded: Set<string>): boolean {
  if (recorded.has(matchId)) return false
  recorded.add(matchId)
  return true
}

export function releaseMatchResultRecording(matchId: string, recorded: Set<string>): void {
  recorded.delete(matchId)
}
