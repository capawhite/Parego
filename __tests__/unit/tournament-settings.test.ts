import { describe, it, expect } from "vitest"
import { parseTournamentSettings, settingsForPersistence } from "@/lib/tournament-settings"
import { DEFAULT_SETTINGS } from "@/lib/types"

describe("parseTournamentSettings", () => {
  it("returns defaults for empty / non-object settings", () => {
    const out = parseTournamentSettings({})
    expect(out.pairingAlgorithm).toBe(DEFAULT_SETTINGS.pairingAlgorithm)
    expect(out.winPoints).toBe(DEFAULT_SETTINGS.winPoints)
    expect(out.plannedSwissRounds).toBe(DEFAULT_SETTINGS.plannedSwissRounds)
    expect(out.swissLastCompletedRound).toBe(0)
  })

  it("migrates fide-swiss to swiss", () => {
    const out = parseTournamentSettings({
      settings: { pairingAlgorithm: "fide-swiss", plannedSwissRounds: 7 },
    })
    expect(out.pairingAlgorithm).toBe("swiss")
    expect(out.plannedSwissRounds).toBe(7)
  })

  it("clamps planned Swiss rounds to Club Swiss bounds", () => {
    expect(parseTournamentSettings({ settings: { plannedSwissRounds: 1 } }).plannedSwissRounds).toBe(3)
    expect(parseTournamentSettings({ settings: { plannedSwissRounds: 99 } }).plannedSwissRounds).toBe(11)
  })

  it("falls back invalid enums to defaults", () => {
    const out = parseTournamentSettings({
      settings: {
        colorBalancePriority: "nope",
        scoreMatchingStrictness: "weird",
        t1CapPreset: "turbo",
      },
    })
    expect(out.colorBalancePriority).toBe(DEFAULT_SETTINGS.colorBalancePriority)
    expect(out.scoreMatchingStrictness).toBe(DEFAULT_SETTINGS.scoreMatchingStrictness)
    expect(out.t1CapPreset).toBe(DEFAULT_SETTINGS.t1CapPreset)
  })

  it("keeps optional thresholds only when > 0", () => {
    const out = parseTournamentSettings({
      settings: { minIdlePlayersBeforePairing: 0, pairingStabilizationMs: -1 },
    })
    expect(out.minIdlePlayersBeforePairing).toBeUndefined()
    expect(out.pairingStabilizationMs).toBeUndefined()

    const kept = parseTournamentSettings({
      settings: { minIdlePlayersBeforePairing: 4, pairingStabilizationMs: 1500 },
    })
    expect(kept.minIdlePlayersBeforePairing).toBe(4)
    expect(kept.pairingStabilizationMs).toBe(1500)
  })

  it("prefers pairing_heartbeat_at column over JSON", () => {
    const out = parseTournamentSettings({
      settings: { pairingHeartbeatAt: "2020-01-01T00:00:00.000Z" },
      pairing_heartbeat_at: "2024-06-01T12:00:00.000Z",
    })
    expect(out.pairingHeartbeatAt).toBe("2024-06-01T12:00:00.000Z")
  })
})

describe("settingsForPersistence", () => {
  it("strips pairingHeartbeatAt", () => {
    const out = settingsForPersistence({
      ...DEFAULT_SETTINGS,
      pairingHeartbeatAt: "2024-01-01T00:00:00.000Z",
    })
    expect(out).not.toHaveProperty("pairingHeartbeatAt")
    expect(out.pairingAlgorithm).toBe(DEFAULT_SETTINGS.pairingAlgorithm)
  })
})
