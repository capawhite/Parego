import { describe, expect, it } from "vitest"
import {
  effectiveTableCountFromDb,
  effectiveTableSlotsForPairing,
} from "@/lib/tournament/effective-table-count"
import { DEFAULT_SETTINGS, type TournamentSettings } from "@/lib/types"

describe("effectiveTableCountFromDb", () => {
  it("uses max of column and settings; active tournaments get at least 1", () => {
    expect(
      effectiveTableCountFromDb({
        tables_count: 0,
        settings: { ...DEFAULT_SETTINGS, tableCount: 6 },
        status: "active",
      }),
    ).toBe(6)
    expect(
      effectiveTableCountFromDb({
        tables_count: 8,
        settings: { ...DEFAULT_SETTINGS, tableCount: 0 },
        status: "active",
      }),
    ).toBe(8)
    expect(
      effectiveTableCountFromDb({
        tables_count: 0,
        settings: { ...DEFAULT_SETTINGS, tableCount: 0 },
        status: "active",
      }),
    ).toBe(1)
  })

  it("setup allows 0 when both sources are 0", () => {
    expect(
      effectiveTableCountFromDb({
        tables_count: 0,
        settings: { ...DEFAULT_SETTINGS, tableCount: 0 },
        status: "setup",
      }),
    ).toBe(0)
  })
})

describe("effectiveTableSlotsForPairing", () => {
  it("returns at least 1", () => {
    const s: TournamentSettings = { ...DEFAULT_SETTINGS, tableCount: 0 }
    expect(effectiveTableSlotsForPairing(0, s)).toBe(1)
    expect(effectiveTableSlotsForPairing(4, { ...s, tableCount: 0 })).toBe(4)
    expect(effectiveTableSlotsForPairing(0, { ...s, tableCount: 3 })).toBe(3)
  })
})
