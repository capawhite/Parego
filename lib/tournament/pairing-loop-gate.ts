import { isSwissAlgorithm } from "@/lib/pairing/swiss"

/**
 * Whether the client (or organizer poller) should run a pairing tick.
 * Pairing authority is organizer-only until a server ticker exists.
 */
export function shouldRunPairingLoop(opts: {
  isOrganizer: boolean
  isActive: boolean
  waitingForFinalResults: boolean
  pairingAlgorithm?: string | null
}): boolean {
  if (!opts.isOrganizer) return false
  if (!opts.isActive) return false
  if (opts.waitingForFinalResults) return false
  if (isSwissAlgorithm(opts.pairingAlgorithm)) return false
  return true
}

/** Heartbeat older than this is treated as stalled (ms). */
export const PAIRING_HEARTBEAT_STALE_MS = 90_000

export function isPairingHeartbeatStale(
  heartbeatAt: number | string | null | undefined,
  now = Date.now(),
): boolean {
  if (heartbeatAt == null) return true
  const ts = typeof heartbeatAt === "string" ? Date.parse(heartbeatAt) : heartbeatAt
  if (!Number.isFinite(ts)) return true
  return now - ts > PAIRING_HEARTBEAT_STALE_MS
}
