import { describe, it, expect, vi, beforeEach } from "vitest"
import { fakeSupabase, type FakeSupabaseConfig } from "../helpers/fake-supabase"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
  adminClientMissingReason: () => "admin missing",
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

async function mockUserClient(userConfig: FakeSupabaseConfig) {
  const { createClient } = await import("@/lib/supabase/server")
  ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(fakeSupabase(userConfig))
}

async function mockClients(userConfig: FakeSupabaseConfig, adminConfig: FakeSupabaseConfig) {
  const { createClient } = await import("@/lib/supabase/server")
  const { createAdminClient } = await import("@/lib/supabase/admin")
  ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(fakeSupabase(userConfig))
  ;(createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(fakeSupabase(adminConfig))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

describe("startTournament", () => {
  it("rejects non-organizers", async () => {
    await mockUserClient({
      user: { id: "random-user" },
      tables: {
        tournaments: {
          data: { organizer_id: "org-1", owner_id: null, status: "setup", settings: {} },
        },
      },
    })
    const { startTournament } = await import("@/app/actions/start-tournament")
    const out = await startTournament("t1")
    expect(out.success).toBe(false)
    expect(out.error).toMatch(/organizer/i)
  })

  it("rejects arena with fewer than 2 players", async () => {
    await mockUserClient({
      user: { id: "org-1" },
      tables: {
        tournaments: {
          data: {
            organizer_id: "org-1",
            owner_id: null,
            status: "setup",
            settings: { pairingAlgorithm: "all-vs-all" },
          },
        },
        players: { data: [{ id: "p1" }] },
      },
    })
    const { startTournament } = await import("@/app/actions/start-tournament")
    const out = await startTournament("t1")
    expect(out.success).toBe(false)
    expect(out.error).toMatch(/at least 2 players/i)
  })

  it("rejects Swiss with fewer than 4 players", async () => {
    await mockUserClient({
      user: { id: "org-1" },
      tables: {
        tournaments: {
          data: {
            organizer_id: "org-1",
            owner_id: null,
            status: "setup",
            settings: { pairingAlgorithm: "swiss", plannedSwissRounds: 5 },
          },
        },
        players: { data: [{ id: "a" }, { id: "b" }, { id: "c" }] },
      },
    })
    const { startTournament } = await import("@/app/actions/start-tournament")
    const out = await startTournament("t1")
    expect(out.success).toBe(false)
    expect(out.error).toMatch(/at least 4 players/i)
  })

  it("rejects Swiss when planned rounds exceed players − 1", async () => {
    await mockUserClient({
      user: { id: "org-1" },
      tables: {
        tournaments: {
          data: {
            organizer_id: "org-1",
            owner_id: null,
            status: "setup",
            settings: { pairingAlgorithm: "swiss", plannedSwissRounds: 5 },
          },
        },
        players: { data: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }] },
      },
    })
    const { startTournament } = await import("@/app/actions/start-tournament")
    const out = await startTournament("t1")
    expect(out.success).toBe(false)
    expect(out.error).toMatch(/cannot exceed 3/i)
  })

  it("starts when organizer has a valid Swiss field", async () => {
    await mockUserClient({
      user: { id: "org-1" },
      tables: {
        tournaments: [
          {
            data: {
              organizer_id: "org-1",
              owner_id: null,
              status: "setup",
              settings: { pairingAlgorithm: "swiss", plannedSwissRounds: 3 },
            },
          },
          { error: null },
        ],
        players: {
          data: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
        },
      },
    })
    const { startTournament } = await import("@/app/actions/start-tournament")
    const out = await startTournament("t1")
    expect(out.success).toBe(true)
  })
})

describe("pairSwissRound gates", () => {
  it("rejects inactive tournaments", async () => {
    await mockClients(
      { user: { id: "org-1" } },
      {
        tables: {
          tournaments: {
            data: {
              organizer_id: "org-1",
              owner_id: null,
              status: "setup",
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
    expect(out.error).toMatch(/not active/i)
  })

  it("rejects non-Swiss algorithms", async () => {
    await mockClients(
      { user: { id: "org-1" } },
      {
        tables: {
          tournaments: {
            data: {
              organizer_id: "org-1",
              owner_id: null,
              status: "active",
              settings: { pairingAlgorithm: "all-vs-all" },
              tables_count: 8,
            },
          },
        },
      },
    )
    const { pairSwissRound } = await import("@/app/actions/pair-swiss-round")
    const out = await pairSwissRound("t1")
    expect(out.success).toBe(false)
    expect(out.error).toMatch(/not using Swiss/i)
  })
})
