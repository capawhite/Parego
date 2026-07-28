import { describe, it, expect } from "vitest"
import {
  shouldRunPairingLoop,
  isPairingHeartbeatStale,
  PAIRING_HEARTBEAT_STALE_MS,
} from "@/lib/tournament/pairing-loop-gate"

describe("shouldRunPairingLoop", () => {
  it("does not run for non-organizers", () => {
    expect(
      shouldRunPairingLoop({
        isOrganizer: false,
        isActive: true,
        waitingForFinalResults: false,
        pairingAlgorithm: "all-vs-all",
      }),
    ).toBe(false)
  })

  it("runs for organizer when active arena", () => {
    expect(
      shouldRunPairingLoop({
        isOrganizer: true,
        isActive: true,
        waitingForFinalResults: false,
        pairingAlgorithm: "balanced-strength",
      }),
    ).toBe(true)
  })

  it("skips fide-swiss and waiting-for-final", () => {
    expect(
      shouldRunPairingLoop({
        isOrganizer: true,
        isActive: true,
        waitingForFinalResults: false,
        pairingAlgorithm: "fide-swiss",
      }),
    ).toBe(false)
    expect(
      shouldRunPairingLoop({
        isOrganizer: true,
        isActive: true,
        waitingForFinalResults: true,
        pairingAlgorithm: "all-vs-all",
      }),
    ).toBe(false)
  })
})

describe("isPairingHeartbeatStale", () => {
  it("treats missing heartbeat as stale", () => {
    expect(isPairingHeartbeatStale(null)).toBe(true)
    expect(isPairingHeartbeatStale(undefined)).toBe(true)
  })

  it("is fresh within window", () => {
    const now = Date.now()
    expect(isPairingHeartbeatStale(now - 1000, now)).toBe(false)
    expect(isPairingHeartbeatStale(new Date(now - 1000).toISOString(), now)).toBe(false)
  })

  it("is stale after threshold", () => {
    const now = Date.now()
    expect(isPairingHeartbeatStale(now - PAIRING_HEARTBEAT_STALE_MS - 1, now)).toBe(true)
  })
})
