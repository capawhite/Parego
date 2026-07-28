import { describe, it, expect, vi, beforeEach } from "vitest"
import { fakeSupabase, type FakeSupabaseConfig } from "../helpers/fake-supabase"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
  adminClientMissingReason: () => "admin missing",
}))

async function mockClients(userConfig: FakeSupabaseConfig, adminConfig: FakeSupabaseConfig) {
  const { createClient } = await import("@/lib/supabase/server")
  const { createAdminClient } = await import("@/lib/supabase/admin")
  ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(fakeSupabase(userConfig))
  ;(createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(fakeSupabase(adminConfig))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("finalizeTournament", () => {
  it("rejects non-organizers", async () => {
    await mockClients(
      { user: { id: "random-user" } },
      {
        tables: {
          tournaments: { data: { organizer_id: "org-1", owner_id: null, status: "active" } },
        },
      },
    )
    const { finalizeTournament } = await import("@/app/actions/finalize-tournament")
    const out = await finalizeTournament("t1")
    expect(out.success).toBe(false)
    expect(out.error).toMatch(/organizer/i)
  })

  it("completes an active tournament for the organizer", async () => {
    await mockClients(
      { user: { id: "org-1" } },
      {
        tables: {
          tournaments: [
            { data: { organizer_id: "org-1", owner_id: null, status: "active" } },
            { error: null },
          ],
        },
      },
    )
    const { finalizeTournament } = await import("@/app/actions/finalize-tournament")
    const out = await finalizeTournament("t1")
    expect(out.success).toBe(true)
  })

  it("is a no-op success when already completed", async () => {
    await mockClients(
      { user: { id: "org-1" } },
      {
        tables: {
          tournaments: { data: { organizer_id: "org-1", owner_id: null, status: "completed" } },
        },
      },
    )
    const { finalizeTournament } = await import("@/app/actions/finalize-tournament")
    const out = await finalizeTournament("t1")
    expect(out.success).toBe(true)
  })
})

describe("recordOrganizerMatchResult", () => {
  it("rejects non-organizers", async () => {
    await mockClients(
      { user: { id: "random-user" } },
      {
        tables: {
          tournaments: { data: { organizer_id: "org-1", owner_id: null } },
        },
      },
    )
    const { recordOrganizerMatchResult } = await import("@/app/actions/record-match-result")
    const out = await recordOrganizerMatchResult({
      tournamentId: "t1",
      matchId: "m1",
      isDraw: true,
      players: [],
      pairedMatches: [],
      allTimeMatches: [],
      settings: {} as never,
    })
    expect(out.success).toBe(false)
    expect(out.error).toMatch(/organizer/i)
  })
})

describe("pairSwissRound", () => {
  it("rejects non-organizers", async () => {
    await mockClients(
      { user: { id: "random-user" } },
      {
        tables: {
          tournaments: {
            data: {
              organizer_id: "org-1",
              owner_id: null,
              status: "active",
              settings: { pairingAlgorithm: "swiss", plannedSwissRounds: 5 },
              tables_count: 8,
            },
          },
        },
      },
    )
    const { pairSwissRound } = await import("@/app/actions/pair-swiss-round")
    const out = await pairSwissRound("t1")
    expect(out.success).toBe(false)
    expect(out.error).toMatch(/organizer/i)
  })
})
