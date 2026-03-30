import { describe, expect, it } from "vitest"
import { minIdlePlayersBeforePairing } from "@/lib/pairing/idle-threshold"
import { DEFAULT_SETTINGS, type TournamentSettings } from "@/lib/types"

describe("minIdlePlayersBeforePairing", () => {
  it("defaults to at least 4 and floor(n/4) when larger, capped by field size", () => {
    const s: TournamentSettings = { ...DEFAULT_SETTINGS, minIdlePlayersBeforePairing: undefined }
    expect(minIdlePlayersBeforePairing(2, s)).toBe(2)
    expect(minIdlePlayersBeforePairing(3, s)).toBe(3)
    expect(minIdlePlayersBeforePairing(8, s)).toBe(4)
    expect(minIdlePlayersBeforePairing(12, s)).toBe(4)
    expect(minIdlePlayersBeforePairing(21, s)).toBe(5)
  })

  it("uses organizer setting when minIdlePlayersBeforePairing is set", () => {
    const s: TournamentSettings = { ...DEFAULT_SETTINGS, minIdlePlayersBeforePairing: 10 }
    expect(minIdlePlayersBeforePairing(21, s)).toBe(10)
    expect(minIdlePlayersBeforePairing(6, s)).toBe(6)
    expect(minIdlePlayersBeforePairing(3, s)).toBe(3)
  })
})
