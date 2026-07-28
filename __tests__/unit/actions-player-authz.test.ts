import { describe, it, expect, vi, beforeEach } from "vitest"
import { fakeSupabase, type FakeSupabaseConfig } from "../helpers/fake-supabase"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
  adminClientMissingReason: () => "admin missing",
}))

const tournament = {
  organizer_id: "org-1",
  owner_id: "owner-1",
  status: "active",
}

async function mockClients(userConfig: FakeSupabaseConfig, adminConfig: FakeSupabaseConfig) {
  const { createClient } = await import("@/lib/supabase/server")
  const { createAdminClient } = await import("@/lib/supabase/admin")
  ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(fakeSupabase(userConfig))
  ;(createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(fakeSupabase(adminConfig))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("removePlayerAction", () => {
  it("rejects unauthenticated callers", async () => {
    await mockClients({ user: null }, {})
    const { removePlayerAction } = await import("@/app/actions/remove-player")
    const out = await removePlayerAction({ tournamentId: "t1", playerId: "p1" })
    expect(out.ok).toBe(false)
    expect(out.error).toMatch(/sign in/i)
  })

  it("rejects a signed-in user who is neither the seat owner nor the organizer", async () => {
    await mockClients(
      { user: { id: "random-user" } },
      {
        tables: {
          tournaments: { data: tournament },
          players: { data: { id: "p1", user_id: "someone-else" } },
        },
      },
    )
    const { removePlayerAction } = await import("@/app/actions/remove-player")
    const out = await removePlayerAction({ tournamentId: "t1", playerId: "p1" })
    expect(out.ok).toBe(false)
    expect(out.error).toMatch(/not allowed/i)
  })

  it("allows a player to leave their own seat", async () => {
    await mockClients(
      { user: { id: "u-alice" } },
      {
        tables: {
          tournaments: { data: tournament },
          players: [{ data: { id: "p1", user_id: "u-alice" } }, { error: null }],
        },
      },
    )
    const { removePlayerAction } = await import("@/app/actions/remove-player")
    const out = await removePlayerAction({ tournamentId: "t1", playerId: "p1" })
    expect(out.ok).toBe(true)
  })

  it("allows the owner (co-organizer) to remove any player", async () => {
    await mockClients(
      { user: { id: "owner-1" } },
      {
        tables: {
          tournaments: { data: tournament },
          players: [{ data: { id: "p1", user_id: "someone-else" } }, { error: null }],
        },
      },
    )
    const { removePlayerAction } = await import("@/app/actions/remove-player")
    const out = await removePlayerAction({ tournamentId: "t1", playerId: "p1" })
    expect(out.ok).toBe(true)
  })
})

describe("updatePlayerPauseState", () => {
  it("rejects a user who is neither the player nor the organizer", async () => {
    await mockClients(
      { user: { id: "random-user" } },
      {
        tables: {
          players: { data: { id: "p1", user_id: "someone-else" } },
          tournaments: { data: tournament },
        },
      },
    )
    const { updatePlayerPauseState } = await import("@/app/actions/update-player-pause")
    const out = await updatePlayerPauseState({ tournamentId: "t1", playerId: "p1", paused: true })
    expect(out.ok).toBe(false)
    expect(out.error).toMatch(/not allowed/i)
  })

  it("allows a player to pause themselves", async () => {
    await mockClients(
      { user: { id: "u-alice" } },
      {
        tables: {
          players: [{ data: { id: "p1", user_id: "u-alice" } }, { error: null }],
          tournaments: { data: tournament },
        },
      },
    )
    const { updatePlayerPauseState } = await import("@/app/actions/update-player-pause")
    const out = await updatePlayerPauseState({ tournamentId: "t1", playerId: "p1", paused: true })
    expect(out.ok).toBe(true)
  })
})
