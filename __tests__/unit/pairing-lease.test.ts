import { describe, expect, it } from "vitest"
import { isPairingLeaseAvailable, pairingLeaseHolderId } from "@/lib/pairing/pairing-lease"

describe("isPairingLeaseAvailable", () => {
  const now = 1_000_000

  it("allows when no lease", () => {
    expect(
      isPairingLeaseAvailable({
        nowMs: now,
        leaseUntilMs: null,
        leaseHolder: null,
        claimant: "a",
      }),
    ).toBe(true)
  })

  it("allows when expired", () => {
    expect(
      isPairingLeaseAvailable({
        nowMs: now,
        leaseUntilMs: now - 1,
        leaseHolder: "other",
        claimant: "a",
      }),
    ).toBe(true)
  })

  it("blocks when held by another", () => {
    expect(
      isPairingLeaseAvailable({
        nowMs: now,
        leaseUntilMs: now + 5000,
        leaseHolder: "other",
        claimant: "a",
      }),
    ).toBe(false)
  })

  it("allows same holder renew", () => {
    expect(
      isPairingLeaseAvailable({
        nowMs: now,
        leaseUntilMs: now + 5000,
        leaseHolder: "a",
        claimant: "a",
      }),
    ).toBe(true)
  })
})

describe("pairingLeaseHolderId", () => {
  it("prefixes organizer id", () => {
    expect(pairingLeaseHolderId("organizer", "u-1")).toBe("organizer:u-1")
  })

  it("uses unique system holders", () => {
    const a = pairingLeaseHolderId("system", null)
    const b = pairingLeaseHolderId("system", null)
    expect(a.startsWith("system:")).toBe(true)
    expect(b.startsWith("system:")).toBe(true)
    expect(a).not.toBe(b)
  })
})
