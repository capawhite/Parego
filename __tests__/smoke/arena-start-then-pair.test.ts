import { describe, it, expect, vi, beforeEach } from "vitest"
import { runPairTick } from "@/lib/pairing/run-pair-tick"
import { computeArenaPairingInsights } from "@/lib/pairing/arena-pairing-insights"
import { DEFAULT_SETTINGS, type ArenaState, type Player } from "@/lib/types"
import { fakeSupabase, type FakeSupabaseConfig } from "../helpers/fake-supabase"

/**
 * Smoke: the critical "started arena → pairings appear" pipeline.
 * Uses runPairTick + pairTournamentImpl (mocked admin) — no browser / live DB.
 */

function player(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    score: 0,
    gamesPlayed: 0,
    streak: 0,
    performance: 0,
    active: true,
    paused: false,
    joinedAt: 0,
    opponentIds: [],
    gameResults: [],
    pieceColors: [],
    checkedInAt: Date.now(),
    ...overrides,
  }
}

function arenaState(players: Player[], overrides: Partial<ArenaState> = {}): ArenaState {
  return {
    players,
    rounds: [],
    currentRound: null,
    pairedMatches: [],
    tournamentStartTime: Date.now(),
    tournamentDuration: 60 * 60 * 1000,
    isActive: true,
    allTimeMatches: [],
    tableCount: 4,
    settings: {
      ...DEFAULT_SETTINGS,
      pairingAlgorithm: "all-vs-all",
      tableCount: 4,
      minIdlePlayersBeforePairing: 2,
    },
    status: "active",
    ...overrides,
  }
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
  adminClientMissingReason: () => "admin missing",
}))

vi.mock("@/lib/pairing/pairing-lease", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pairing/pairing-lease")>(
    "@/lib/pairing/pairing-lease",
  )
  return {
    ...actual,
    claimPairingLease: vi.fn(async () => true),
    releasePairingLease: vi.fn(async () => undefined),
  }
})

describe("smoke: arena start then pair", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("creates matches when enough eligible players and free tables", () => {
    const players = [player("a"), player("b"), player("c"), player("d")]
    const out = runPairTick({
      players,
      pairedMatches: [],
      allTimeMatches: [],
      settings: {
        ...DEFAULT_SETTINGS,
        pairingAlgorithm: "all-vs-all",
        tableCount: 4,
        minIdlePlayersBeforePairing: 2,
      },
      tableCount: 4,
      hasVenue: false,
    })
    expect(out.wouldPair).toBe(true)
    expect(out.newMatches.length).toBeGreaterThan(0)
    const ids = new Set(out.newMatches.flatMap((m) => [m.player1.id, m.player2.id]))
    expect(ids.size).toBeGreaterThanOrEqual(2)
    for (const m of out.newMatches) {
      expect(m.tableNumber).toBeDefined()
      expect(m.result?.completed).not.toBe(true)
    }
  })

  it("creates zero matches when venue is set and nobody is checked in", () => {
    const players = [
      player("a", { checkedInAt: null }),
      player("b", { checkedInAt: null }),
      player("c", { checkedInAt: null }),
      player("d", { checkedInAt: null }),
    ]
    const out = runPairTick({
      players,
      pairedMatches: [],
      allTimeMatches: [],
      settings: {
        ...DEFAULT_SETTINGS,
        pairingAlgorithm: "all-vs-all",
        tableCount: 4,
        minIdlePlayersBeforePairing: 2,
      },
      tableCount: 4,
      hasVenue: true,
    })
    expect(out.newMatches).toEqual([])
    expect(out.wouldPair).toBe(false)
  })

  it("insights surface need_check_in when venue blocks the field", () => {
    const players = [
      player("a", { checkedInAt: null, name: "Alice" }),
      player("b", { checkedInAt: null, name: "Bob" }),
      player("c", { checkedInAt: null, name: "Cara" }),
      player("d", { checkedInAt: null, name: "Dan" }),
    ]
    const ins = computeArenaPairingInsights({
      state: arenaState(players),
      nowMs: Date.now(),
      tournamentMetadata: { latitude: 40.4, longitude: -3.7 },
      isActive: true,
      waitingForFinalResults: false,
    })
    expect(ins.hasVenue).toBe(true)
    expect(ins.notCheckedInCount).toBe(4)
    expect(ins.wouldPair).toBe(false)
    expect(ins.blockers.some((b) => b.id === "need_check_in")).toBe(true)
    expect(ins.players.every((p) => p.status === "not_checked_in")).toBe(true)
  })

  it("pairTournamentImpl upserts matches for an active arena with checked-in players", async () => {
    const { createAdminClient } = await import("@/lib/supabase/admin")
    const now = new Date().toISOString()
    const playerRows = ["a", "b", "c", "d"].map((id) => ({
      id,
      name: id,
      tournament_id: "T1",
      points: 0,
      games_played: 0,
      current_streak: 0,
      paused: false,
      is_removed: false,
      is_paused: false,
      created_at: now,
      opponents: [],
      results: [],
      colors: [],
      checked_in_at: now,
      user_id: null,
      is_guest: true,
    }))

    let upserted: unknown = null
    const adminConfig: FakeSupabaseConfig = {
      tables: {
        tournaments: [
          {
            data: {
              id: "T1",
              status: "active",
              organizer_id: "org-1",
              owner_id: null,
              tables_count: 4,
              latitude: null,
              longitude: null,
              settings: {
                ...DEFAULT_SETTINGS,
                pairingAlgorithm: "all-vs-all",
                tableCount: 4,
                minIdlePlayersBeforePairing: 2,
              },
            },
          },
          // heartbeat update
          { data: null },
        ],
        players: { data: playerRows },
        matches: [
          { data: [] },
          {
            data: null,
            // capture upsert by wrapping — fake returns this for second matches call
          },
        ],
      },
    }

    const client = fakeSupabase(adminConfig)
    const originalFrom = client.from.bind(client)
    client.from = (table: string) => {
      const builder = originalFrom(table) as ReturnType<typeof originalFrom> & {
        upsert?: (rows: unknown) => Promise<{ data: null; error: null }>
      }
      if (table === "matches") {
        return new Proxy(builder as object, {
          get(target, prop) {
            if (prop === "upsert") {
              return async (rows: unknown) => {
                upserted = rows
                return { data: null, error: null }
              }
            }
            return (target as Record<string | symbol, unknown>)[prop]
          },
        })
      }
      return builder
    }

    ;(createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(client)

    const { pairTournamentImpl } = await import("@/lib/pairing/pair-tournament")
    const out = await pairTournamentImpl("T1", "org-1", client, { mode: "organizer" })

    expect(out.success).toBe(true)
    expect(out.skippedDueToLease).not.toBe(true)
    expect((out.createdCount ?? 0) > 0).toBe(true)
    expect(Array.isArray(upserted)).toBe(true)
    expect((upserted as unknown[]).length).toBeGreaterThan(0)
  })

  it("pairTournamentImpl creates nothing when venue set and players lack check-in", async () => {
    const { createAdminClient } = await import("@/lib/supabase/admin")
    const now = new Date().toISOString()
    const playerRows = ["a", "b", "c", "d"].map((id) => ({
      id,
      name: id,
      tournament_id: "T2",
      points: 0,
      games_played: 0,
      current_streak: 0,
      paused: false,
      is_removed: false,
      is_paused: false,
      created_at: now,
      opponents: [],
      results: [],
      colors: [],
      checked_in_at: null,
      user_id: null,
      is_guest: true,
    }))

    const client = fakeSupabase({
      tables: {
        tournaments: [
          {
            data: {
              id: "T2",
              status: "active",
              organizer_id: "org-1",
              owner_id: null,
              tables_count: 4,
              latitude: 40.4,
              longitude: -3.7,
              settings: {
                ...DEFAULT_SETTINGS,
                pairingAlgorithm: "all-vs-all",
                tableCount: 4,
                minIdlePlayersBeforePairing: 2,
              },
            },
          },
          { data: null },
        ],
        players: { data: playerRows },
        matches: { data: [] },
      },
    })
    ;(createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(client)

    const { pairTournamentImpl } = await import("@/lib/pairing/pair-tournament")
    const out = await pairTournamentImpl("T2", "org-1", client, { mode: "organizer" })

    expect(out.success).toBe(true)
    expect(out.createdCount).toBe(0)
    expect(out.matchIds).toEqual([])
  })
})
