import { describe, it, expect, vi, beforeEach } from "vitest"

// submitMatchResultImpl uses @supabase/supabase-js (not @/lib/supabase/server)
const matchSingle = vi.fn()
const tournamentSingle = vi.fn()
const matchUpdateChain = {
  eq: vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    })),
  })),
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "matches") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: matchSingle,
          update: vi.fn(() => matchUpdateChain),
        }
      }
      if (table === "tournaments") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: tournamentSingle,
        }
      }
      return {}
    }),
  })),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

describe("submitMatchResult (integration: player submits from device)", () => {
  const mockUser = { id: "user-alice" }
  const matchId = "match-1"
  const tournamentId = "tour-1"

  const mockMatch = {
    id: matchId,
    tournament_id: tournamentId,
    completed: false,
    player1_id: "player-1",
    player2_id: "player-2",
    player1_data: JSON.stringify({ userId: "user-alice" }),
    player2_data: JSON.stringify({ userId: "user-bob" }),
    player1_submission: null,
    player2_submission: null,
  }

  const mockTournament = { status: "active", settings: {} }

  function createMockSupabase(overrides: {
    user?: { id: string } | null
  } = {}) {
    const user = overrides.user !== undefined ? overrides.user : mockUser
    return {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    }
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"

    matchSingle.mockReset()
    tournamentSingle.mockReset()
    matchSingle.mockResolvedValue({ data: mockMatch, error: null })
    tournamentSingle.mockResolvedValue({ data: mockTournament, error: null })

    const { createClient } = await import("@/lib/supabase/server")
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue(createMockSupabase())
  })

  it("returns error when not authenticated", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createMockSupabase({ user: null }),
    )
    const { submitMatchResult } = await import("@/app/actions/submit-result")
    const out = await submitMatchResult(matchId, "player1-win", true)
    expect(out.success).toBe(false)
    expect(out.errorCode).toBe("MISSING_AUTH")
    expect(out.error).toContain("logged in")
  })

  it("returns error when match not found", async () => {
    matchSingle.mockResolvedValueOnce({ data: null, error: { message: "Not found" } })
    const { submitMatchResult } = await import("@/app/actions/submit-result")
    const out = await submitMatchResult(matchId, "player1-win", true)
    expect(out.success).toBe(false)
    expect(out.errorCode).toBe("MATCH_NOT_FOUND")
    expect(out.error).toMatch(/not found/i)
  })

  it("returns error when user is not a player in the match", async () => {
    const { createClient } = await import("@/lib/supabase/server")
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      createMockSupabase({
        user: { id: "user-stranger" },
      }),
    )
    const { submitMatchResult } = await import("@/app/actions/submit-result")
    const out = await submitMatchResult(matchId, "player1-win", true)
    expect(out.success).toBe(false)
    expect(out.errorCode).toBe("NOT_A_PLAYER_IN_MATCH")
    expect(out.error).toMatch(/not a player/i)
  })
})
