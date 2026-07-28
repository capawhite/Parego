import { describe, it, expect, vi, beforeEach } from "vitest"

const matchSingle = vi.fn()
const tournamentSingle = vi.fn()
const playerSingles: Record<string, unknown> = {}
const matchUpdateEq = vi.fn()
const matchUpdateSelect = vi.fn()
const playersUpdate = vi.fn()

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "matches") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: matchSingle,
          update: vi.fn(() => ({
            eq: matchUpdateEq,
          })),
        }
      }
      if (table === "tournaments") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: tournamentSingle,
        }
      }
      if (table === "players") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn(async () => {
            // last eq id determines which player — simplified: return by call order via queue
            return { data: playerSingles.__next ?? null, error: null }
          }),
          update: playersUpdate.mockReturnValue({
            eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          }),
        }
      }
      return {}
    }),
  })),
  adminClientMissingReason: vi.fn(() => "none"),
}))

describe("submitMatchResultImpl both-agree completion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon"
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    const baseMatch = {
      id: "match-1",
      tournament_id: "t1",
      completed: false,
      player1_id: "p1",
      player2_id: "p2",
      player1_data: JSON.stringify({ userId: "user-a" }),
      player2_data: JSON.stringify({ userId: "user-b" }),
      player1_submission: null,
      player2_submission: null,
      table_number: 1,
    }

    matchSingle.mockResolvedValue({ data: { ...baseMatch }, error: null })
    tournamentSingle.mockResolvedValue({
      data: { status: "active", settings: { winPoints: 2, drawPoints: 1, lossPoints: 0, streakEnabled: false } },
      error: null,
    })

    // First update: save submission — return both agree
    matchUpdateEq.mockImplementation(() => {
      const chain = {
        eq: vi.fn(() => chain),
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: {
              ...baseMatch,
              player1_submission: "player1-win",
              player2_submission: "player1-win",
            },
            error: null,
          }),
        })),
      }
      // completion path: .eq("completed", false).select("id")
      ;(chain as any).then = undefined
      matchUpdateSelect.mockReturnValue({
        // for .select("id") without single — return rows
      })
      // Make .eq after update return either select().single or select returning rows
      return {
        eq: vi.fn((col: string) => {
          if (col === "completed") {
            return {
              select: vi.fn().mockResolvedValue({ data: [{ id: "match-1" }], error: null }),
            }
          }
          return {
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  ...baseMatch,
                  player1_submission: "player1-win",
                  player2_submission: "player1-win",
                },
                error: null,
              }),
            })),
            eq: vi.fn(() => ({
              select: vi.fn().mockResolvedValue({ data: [{ id: "match-1" }], error: null }),
            })),
          }
        }),
      }
    })
  })

  it("completes match once when both agree and returns updatedPlayers", async () => {
    const p1 = {
      id: "p1",
      points: 0,
      games_played: 0,
      current_streak: 0,
      results: [],
      opponents: [],
      colors: [],
      points_earned: [],
      table_numbers: [],
      white_count: 0,
      black_count: 0,
      is_guest: false,
      user_id: "user-a",
    }
    const p2 = {
      ...p1,
      id: "p2",
      user_id: "user-b",
    }

    // submitting player check then p1/p2 load for scoring
    const playerQueue = [
      { is_guest: false, user_id: "user-a" },
      p1,
      p2,
    ]
    let playerIdx = 0

    const { createAdminClient } = await import("@/lib/supabase/admin")
    ;(createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "matches") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: matchSingle,
            update: vi.fn(() => ({
              eq: vi.fn((col: string) => {
                if (col === "id") {
                  return {
                    select: vi.fn(() => ({
                      single: vi.fn().mockResolvedValue({
                        data: {
                          id: "match-1",
                          tournament_id: "t1",
                          completed: false,
                          player1_id: "p1",
                          player2_id: "p2",
                          player1_data: JSON.stringify({ userId: "user-a" }),
                          player2_data: JSON.stringify({ userId: "user-b" }),
                          player1_submission: "player1-win",
                          player2_submission: "player1-win",
                          table_number: 1,
                        },
                        error: null,
                      }),
                    })),
                    eq: vi.fn(() => ({
                      select: vi.fn().mockResolvedValue({ data: [{ id: "match-1" }], error: null }),
                    })),
                  }
                }
                return {
                  select: vi.fn().mockResolvedValue({ data: [{ id: "match-1" }], error: null }),
                }
              }),
            })),
          }
        }
        if (table === "tournaments") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: tournamentSingle,
          }
        }
        if (table === "players") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn(async () => {
              const data = playerQueue[playerIdx++] ?? null
              return { data, error: data ? null : { message: "missing" } }
            }),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ error: null }),
              })),
            })),
          }
        }
        return {}
      }),
    })

    // First fetch match (incomplete, no submissions yet) — side resolution needs user-a as p1
    matchSingle.mockResolvedValueOnce({
      data: {
        id: "match-1",
        tournament_id: "t1",
        completed: false,
        player1_id: "p1",
        player2_id: "p2",
        player1_data: JSON.stringify({ userId: "user-a" }),
        player2_data: JSON.stringify({ userId: "user-b" }),
        player1_submission: null,
        player2_submission: "player1-win",
        table_number: 1,
      },
      error: null,
    })

    const { submitMatchResultImpl } = await import("@/lib/submit-match-result")
    const out = await submitMatchResultImpl("match-1", "player1-win", true, { userId: "user-a" })

    expect(out.success).toBe(true)
    expect(out.matchCompleted).toBe(true)
    expect(out.updatedPlayers).toHaveLength(2)
    expect(out.updatedPlayers?.[0].points).toBeGreaterThanOrEqual(0)
  })

  it("second completion is no-op when completed rows empty", async () => {
    const { createAdminClient } = await import("@/lib/supabase/admin")
    let updateCount = 0
    ;(createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "matches") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: "match-1",
                tournament_id: "t1",
                completed: false,
                player1_id: "p1",
                player2_id: "p2",
                player1_data: JSON.stringify({ userId: "user-a" }),
                player2_data: JSON.stringify({ userId: "user-b" }),
                player1_submission: null,
                player2_submission: "draw",
                table_number: 1,
              },
              error: null,
            }),
            update: vi.fn(() => ({
              eq: vi.fn(() => {
                updateCount++
                // first update: submission save
                if (updateCount === 1) {
                  return {
                    select: vi.fn(() => ({
                      single: vi.fn().mockResolvedValue({
                        data: {
                          id: "match-1",
                          tournament_id: "t1",
                          completed: false,
                          player1_id: "p1",
                          player2_id: "p2",
                          player1_submission: "draw",
                          player2_submission: "draw",
                        },
                        error: null,
                      }),
                    })),
                  }
                }
                // completion attempt loses race
                return {
                  eq: vi.fn(() => ({
                    select: vi.fn().mockResolvedValue({ data: [], error: null }),
                  })),
                }
              }),
            })),
          }
        }
        if (table === "tournaments") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: tournamentSingle,
          }
        }
        if (table === "players") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { is_guest: false, user_id: "user-a" },
              error: null,
            }),
          }
        }
        return {}
      }),
    })

    const { submitMatchResultImpl } = await import("@/lib/submit-match-result")
    const out = await submitMatchResultImpl("match-1", "draw", true, { userId: "user-a" })
    expect(out.success).toBe(true)
    expect(out.matchCompleted).toBe(true)
    expect(out.updatedPlayers).toBeUndefined()
  })
})
