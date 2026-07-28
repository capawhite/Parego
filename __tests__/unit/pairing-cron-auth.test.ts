import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { isPairingCronAuthorized, pairingCronSecretConfigured } from "@/lib/pairing/cron-auth"

describe("pairing cron auth", () => {
  const prev = process.env.PAIRING_CRON_SECRET

  beforeEach(() => {
    process.env.PAIRING_CRON_SECRET = "test-secret-value-32chars-xxxxxx"
  })

  afterEach(() => {
    if (prev === undefined) delete process.env.PAIRING_CRON_SECRET
    else process.env.PAIRING_CRON_SECRET = prev
  })

  it("accepts Bearer token", () => {
    const req = new Request("http://localhost/api/cron/pair-active", {
      headers: { Authorization: "Bearer test-secret-value-32chars-xxxxxx" },
    })
    expect(isPairingCronAuthorized(req)).toBe(true)
    expect(pairingCronSecretConfigured()).toBe(true)
  })

  it("accepts x-parego-pairing-secret header", () => {
    const req = new Request("http://localhost/api/cron/pair-active", {
      headers: { "x-parego-pairing-secret": "test-secret-value-32chars-xxxxxx" },
    })
    expect(isPairingCronAuthorized(req)).toBe(true)
  })

  it("rejects wrong or missing secret", () => {
    expect(
      isPairingCronAuthorized(
        new Request("http://localhost/x", { headers: { Authorization: "Bearer wrong" } }),
      ),
    ).toBe(false)
    expect(isPairingCronAuthorized(new Request("http://localhost/x"))).toBe(false)
  })
})
