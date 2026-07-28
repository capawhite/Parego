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
  const { claimGuestHistoryForDevice } = await import("@/app/actions/claim-guest-history")
  return claimGuestHistoryForDevice
}

describe("claimGuestHistoryForDevice", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rejects unauthenticated users", async () => {
    const claim = await setup({ user: null }, {})
    const out = await claim(["p1"], "dev-1")
    expect(out.success).toBe(false)
    expect(out.error).toMatch(/signed in/i)
  })

  it("succeeds with zero claims for empty id list", async () => {
    const claim = await setup({ user: { id: "u1" } }, {})
    const out = await claim([], "dev-1")
    expect(out).toEqual({ success: true, claimedCount: 0 })
  })

  it("rejects when device id is missing", async () => {
    const claim = await setup({ user: { id: "u1" } }, {})
    const out = await claim(["p1"], null)
    expect(out.success).toBe(false)
    expect(out.error).toMatch(/device/i)
  })

  it("only claims device-matched seats from completed tournaments", async () => {
    const claim = await setup(
      { user: { id: "u1" } },
      {
        tables: {
          players: [
            {
              // unclaimed candidates fetched by id
              data: [
                { id: "p1", tournament_id: "t-done", user_id: null, device_id: "dev-1" },
                { id: "p2", tournament_id: "t-done", user_id: null, device_id: "other-device" },
                { id: "p3", tournament_id: "t-live", user_id: null, device_id: "dev-1" },
              ],
            },
            // update(...).select("id") result — only the eligible row
            { data: [{ id: "p1" }] },
          ],
          tournaments: {
            data: [
              { id: "t-done", status: "completed" },
              { id: "t-live", status: "active" },
            ],
          },
        },
      },
    )
    const out = await claim(["p1", "p2", "p3"], "dev-1")
    expect(out.success).toBe(true)
    expect(out.claimedCount).toBe(1)
  })

  it("returns zero when no candidate matches the device", async () => {
    const claim = await setup(
      { user: { id: "u1" } },
      {
        tables: {
          players: {
            data: [{ id: "p1", tournament_id: "t1", user_id: null, device_id: "someone-else" }],
          },
        },
      },
    )
    const out = await claim(["p1"], "dev-1")
    expect(out).toEqual({ success: true, claimedCount: 0 })
  })
})
