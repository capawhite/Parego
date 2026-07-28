import { describe, it, expect, vi, beforeEach } from "vitest"
import { fakeSupabase, type FakeSupabaseConfig } from "../helpers/fake-supabase"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
  adminClientMissingReason: () => "admin missing",
}))
vi.mock("next/headers", () => ({
  headers: async () => new Map([["x-forwarded-for", "203.0.113.7"]]),
}))
vi.mock("@/lib/sentry", () => ({ captureException: vi.fn() }))

const openTournament = {
  id: "t1",
  status: "setup",
  settings: {},
  organizer_id: "org-1",
  owner_id: null,
}

async function setup(userConfig: FakeSupabaseConfig, adminConfig: FakeSupabaseConfig) {
  const { createClient } = await import("@/lib/supabase/server")
  const { createAdminClient } = await import("@/lib/supabase/admin")
  ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(fakeSupabase(userConfig))
  ;(createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(fakeSupabase(adminConfig))
  const { joinTournamentAction } = await import("@/app/actions/join-tournament")
  return joinTournamentAction
}

describe("joinTournamentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rejects guest joins without a device id", async () => {
    const join = await setup({ user: null }, { tables: { tournaments: { data: openTournament } } })
    const out = await join({ tournamentId: "t1", name: "Guest One", isGuest: true })
    expect(out.success).toBe(false)
    expect(out.errorCode).toBe("DEVICE_REQUIRED")
  })

  it("rejects registered joins when the session does not match userId", async () => {
    const join = await setup(
      { user: { id: "someone-else" } },
      { tables: { tournaments: { data: openTournament } } },
    )
    const out = await join({
      tournamentId: "t1",
      name: "Alice",
      isGuest: false,
      userId: "u-alice",
    })
    expect(out.success).toBe(false)
    expect(out.errorCode).toBe("UNAUTHORIZED")
  })

  it("rejects organizer adds from non-organizers", async () => {
    const join = await setup(
      { user: { id: "not-the-organizer" } },
      { tables: { tournaments: { data: openTournament } } },
    )
    const out = await join({
      tournamentId: "t1",
      name: "Added Guest",
      isGuest: true,
      asOrganizer: true,
    })
    expect(out.success).toBe(false)
    expect(out.errorCode).toBe("UNAUTHORIZED")
  })

  it("rejects joins when the tournament is not joinable", async () => {
    const join = await setup(
      { user: null },
      {
        tables: {
          tournaments: {
            data: { ...openTournament, status: "completed" },
          },
        },
      },
    )
    const out = await join({
      tournamentId: "t1",
      name: "Guest",
      isGuest: true,
      deviceId: "dev-1",
    })
    expect(out.success).toBe(false)
    expect(out.errorCode).toBe("NOT_JOINABLE")
  })

  it("accepts a guest join with a device id", async () => {
    const join = await setup(
      { user: null },
      {
        tables: {
          tournaments: { data: openTournament },
          players: [
            { count: 0 }, // device-window rate limit
            { count: 0 }, // tournament burst rate limit
            { data: null }, // existing device check
            { data: [] }, // name uniqueness
            { error: null }, // insert
          ],
        },
      },
    )
    const out = await join({
      tournamentId: "t1",
      name: "Guest One",
      isGuest: true,
      deviceId: "dev-1",
    })
    expect(out.success).toBe(true)
    expect(out.playerId).toBeTruthy()
  })
})
