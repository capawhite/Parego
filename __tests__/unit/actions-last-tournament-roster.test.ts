import { describe, it, expect, vi, beforeEach } from "vitest"
import { fakeSupabase, type FakeSupabaseConfig } from "../helpers/fake-supabase"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
  adminClientMissingReason: () => "admin missing",
}))

async function setup(userConfig: FakeSupabaseConfig, adminConfig: FakeSupabaseConfig) {
  const { createClient } = await import("@/lib/supabase/server")
  const { createAdminClient } = await import("@/lib/supabase/admin")
  ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(fakeSupabase(userConfig))
  ;(createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(fakeSupabase(adminConfig))
  const { getLastTournamentRoster } = await import("@/app/actions/last-tournament-roster")
  return getLastTournamentRoster
}

describe("getLastTournamentRoster", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rejects unauthenticated users", async () => {
    const getRoster = await setup({ user: null }, {})
    const out = await getRoster("current-t")
    expect(out.success).toBe(false)
    expect(out.error).toMatch(/sign in/i)
  })

  it("returns empty players when organizer has no prior tournament", async () => {
    const getRoster = await setup(
      { user: { id: "u1" } },
      {
        tables: {
          tournaments: { data: null },
        },
      },
    )
    const out = await getRoster("current-t")
    expect(out).toEqual({ success: true, players: [] })
  })

  it("returns deduped players from the most recent other tournament", async () => {
    const getRoster = await setup(
      { user: { id: "u1" } },
      {
        tables: {
          tournaments: {
            data: { id: "prev-t", name: "Friday Night", created_at: "2026-01-01" },
          },
          players: {
            data: [
              { name: "Alice", user_id: "ua", rating: 1600, is_guest: false, is_removed: false },
              { name: "Bob", user_id: null, rating: 1200, is_guest: true, is_removed: false },
              { name: "Alice", user_id: "ua", rating: 1600, is_guest: false, is_removed: false },
              { name: "Gone", user_id: null, rating: null, is_guest: true, is_removed: true },
            ],
          },
        },
      },
    )
    const out = await getRoster("current-t")
    expect(out.success).toBe(true)
    expect(out.tournamentId).toBe("prev-t")
    expect(out.tournamentName).toBe("Friday Night")
    expect(out.players).toEqual([
      { name: "Alice", userId: "ua", rating: 1600, isGuest: false },
      { name: "Bob", userId: null, rating: 1200, isGuest: true },
    ])
  })
})
