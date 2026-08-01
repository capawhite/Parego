import { describe, expect, it } from "vitest"
import {
  DEFAULT_ARENA_DURATION_MINUTES,
  STALE_GRACE_AFTER_END_MS,
  isTournamentStale,
  tournamentStaleDeadlineMs,
} from "@/lib/tournament/stale"

describe("tournament stale detection", () => {
  const start = "2026-08-01T12:00:00.000Z"
  const startMs = Date.parse(start)

  it("active 60m event becomes stale after duration + 24h", () => {
    const row = {
      id: "a",
      status: "active" as const,
      start_time: start,
      settings: { arenaDurationMinutes: 60 },
    }
    const deadline = tournamentStaleDeadlineMs(row)
    expect(deadline).toBe(startMs + 60 * 60 * 1000 + STALE_GRACE_AFTER_END_MS)
    expect(isTournamentStale(row, deadline! - 1)).toBe(false)
    expect(isTournamentStale(row, deadline!)).toBe(true)
  })

  it("defaults to 60 minutes when duration is missing", () => {
    const row = { id: "b", status: "active" as const, start_time: start, settings: {} }
    const deadline = tournamentStaleDeadlineMs(row)
    expect(deadline).toBe(
      startMs + DEFAULT_ARENA_DURATION_MINUTES * 60 * 1000 + STALE_GRACE_AFTER_END_MS,
    )
  })

  it("setup with scheduled start goes stale a day after that start", () => {
    const row = {
      id: "c",
      status: "setup" as const,
      start_time: start,
      settings: { arenaDurationMinutes: 60 },
    }
    expect(tournamentStaleDeadlineMs(row)).toBe(startMs + STALE_GRACE_AFTER_END_MS)
    expect(isTournamentStale(row, startMs + STALE_GRACE_AFTER_END_MS)).toBe(true)
  })

  it("setup without start_time is not auto-judged", () => {
    expect(
      tournamentStaleDeadlineMs({
        id: "d",
        status: "setup",
        start_time: null,
        created_at: start,
      }),
    ).toBeNull()
  })

  it("completed is never stale", () => {
    expect(
      isTournamentStale({
        id: "e",
        status: "completed",
        start_time: start,
        settings: { arenaDurationMinutes: 60 },
      }),
    ).toBe(false)
  })
})
