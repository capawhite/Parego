import { describe, expect, it } from "vitest"
import { isDiscoverableTournament, type TournamentData } from "@/lib/database/tournament-db"

function base(partial: Partial<TournamentData>): TournamentData {
  return {
    id: "t1",
    name: "Test",
    status: "setup",
    tables_count: 4,
    settings: {} as TournamentData["settings"],
    ...partial,
  }
}

describe("isDiscoverableTournament", () => {
  const now = Date.parse("2026-08-01T12:00:00.000Z")

  it("hides completed events", () => {
    expect(isDiscoverableTournament(base({ status: "completed" }), now)).toBe(false)
  })

  it("keeps active events", () => {
    expect(isDiscoverableTournament(base({ status: "active", start_time: "2026-07-01T00:00:00.000Z" }), now)).toBe(
      true,
    )
  })

  it("keeps setup without start time", () => {
    expect(isDiscoverableTournament(base({ status: "setup", start_time: undefined }), now)).toBe(true)
  })

  it("hides setup events whose start is long past", () => {
    expect(
      isDiscoverableTournament(base({ status: "setup", start_time: "2026-07-20T18:00:00.000Z" }), now),
    ).toBe(false)
  })

  it("keeps setup events within grace after start", () => {
    expect(
      isDiscoverableTournament(base({ status: "setup", start_time: "2026-08-01T10:30:00.000Z" }), now),
    ).toBe(true)
  })
})
