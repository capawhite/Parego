"use server"

import { createHash } from "crypto"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient, adminClientMissingReason } from "@/lib/supabase/admin"
import { parseTournamentSettings } from "@/lib/tournament-settings"
import type { TournamentData } from "@/lib/database/tournament-db"

/** In-process IP rate limit (best-effort across serverless instances). */
const ipJoinBuckets = new Map<string, { start: number; count: number }>()

export type JoinTournamentInput = {
  tournamentId: string
  name: string
  /** Registered join: omit or null for guest */
  userId?: string | null
  isGuest: boolean
  rating?: number | null
  deviceId?: string | null
  checkedInAt?: string | null
  presenceSource?: "gps" | "qr" | "override" | null
  /** When true, caller is tournament organizer adding a player (allows guest names). */
  asOrganizer?: boolean
  playerId?: string
}

export type JoinTournamentResult = {
  success: boolean
  error?: string
  errorCode?:
    | "NOT_FOUND"
    | "NOT_JOINABLE"
    | "NAME_TAKEN"
    | "ALREADY_JOINED"
    | "RATE_LIMITED"
    | "UNAUTHORIZED"
    | "MISCONFIGURED"
    | "INSERT_FAILED"
    | "DEVICE_REQUIRED"
  playerId?: string
}

const WINDOW_MS = 10 * 60 * 1000
const MAX_JOINS_PER_DEVICE_WINDOW = 8
const MAX_JOINS_PER_IP_WINDOW = 30
const MAX_JOINS_PER_TOURNAMENT_MINUTE = 40

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32)
}

async function clientIp(): Promise<string> {
  const h = await headers()
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim()
  return fwd || h.get("x-real-ip") || "unknown"
}

function isJoinableStatus(status: string, allowLateJoin: boolean): boolean {
  if (status === "setup") return true
  if (status === "active" && allowLateJoin) return true
  return false
}

/**
 * Server-side join (service role). Required for guests after RLS hardening.
 * Rate-limits by device id, IP, and per-tournament burst.
 */
export async function joinTournamentAction(input: JoinTournamentInput): Promise<JoinTournamentResult> {
  const admin = createAdminClient()
  if (!admin) {
    return { success: false, error: adminClientMissingReason(), errorCode: "MISCONFIGURED" }
  }

  const name = input.name?.trim()
  if (!name) {
    return { success: false, error: "Name required", errorCode: "INSERT_FAILED" }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const asOrganizer = Boolean(input.asOrganizer)
  if (asOrganizer) {
    if (!user) return { success: false, error: "Sign in required", errorCode: "UNAUTHORIZED" }
  } else if (!input.isGuest) {
    if (!user || user.id !== input.userId) {
      return { success: false, error: "Sign in required", errorCode: "UNAUTHORIZED" }
    }
  }

  const { data: tournament, error: tErr } = await admin
    .from("tournaments")
    .select("id, status, settings, organizer_id, owner_id")
    .eq("id", input.tournamentId)
    .maybeSingle()

  if (tErr || !tournament) {
    return { success: false, error: "Tournament not found", errorCode: "NOT_FOUND" }
  }

  if (asOrganizer) {
    if (user!.id !== tournament.organizer_id && user!.id !== tournament.owner_id) {
      return { success: false, error: "Only the organizer can add players", errorCode: "UNAUTHORIZED" }
    }
  } else {
    const settings = parseTournamentSettings(tournament)
    if (!isJoinableStatus(tournament.status, settings.allowLateJoin !== false)) {
      return { success: false, error: "Tournament is not open for joining", errorCode: "NOT_JOINABLE" }
    }
  }

  const deviceId =
    typeof input.deviceId === "string" && input.deviceId.trim() ? input.deviceId.trim() : null

  // Guest joins must carry device_id (uniqueness + rate limits). Organizer-added guests may omit.
  if (!asOrganizer && input.isGuest && !deviceId) {
    return {
      success: false,
      error: "Device id required to join as guest",
      errorCode: "DEVICE_REQUIRED",
    }
  }

  // Rate limits (public joins only — organizers adding field may batch)
  if (!asOrganizer) {
    const sinceWindow = new Date(Date.now() - WINDOW_MS).toISOString()
    const sinceMinute = new Date(Date.now() - 60_000).toISOString()
    const ipKey = hashIp(await clientIp())

    if (deviceId) {
      const { count } = await admin
        .from("players")
        .select("id", { count: "exact", head: true })
        .eq("device_id", deviceId)
        .gte("created_at", sinceWindow)
      if ((count ?? 0) >= MAX_JOINS_PER_DEVICE_WINDOW) {
        return { success: false, error: "Too many joins from this device. Try again later.", errorCode: "RATE_LIMITED" }
      }
    }

    const { count: tournamentBurst } = await admin
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", input.tournamentId)
      .gte("created_at", sinceMinute)
    if ((tournamentBurst ?? 0) >= MAX_JOINS_PER_TOURNAMENT_MINUTE) {
      return { success: false, error: "Join rate limit for this tournament. Try again shortly.", errorCode: "RATE_LIMITED" }
    }

    const ipBucket = ipJoinBuckets.get(ipKey)
    const now = Date.now()
    if (!ipBucket || now - ipBucket.start > WINDOW_MS) {
      ipJoinBuckets.set(ipKey, { start: now, count: 1 })
    } else {
      ipBucket.count += 1
      if (ipBucket.count > MAX_JOINS_PER_IP_WINDOW) {
        return { success: false, error: "Too many joins from this network. Try again later.", errorCode: "RATE_LIMITED" }
      }
    }
  }

  if (input.userId) {
    const { data: existingUser } = await admin
      .from("players")
      .select("id")
      .eq("tournament_id", input.tournamentId)
      .eq("user_id", input.userId)
      .maybeSingle()
    if (existingUser) {
      return { success: false, error: "Already joined", errorCode: "ALREADY_JOINED", playerId: existingUser.id }
    }
  }

  if (deviceId && !asOrganizer) {
    const { data: existingDevice } = await admin
      .from("players")
      .select("id")
      .eq("tournament_id", input.tournamentId)
      .eq("device_id", deviceId)
      .maybeSingle()
    if (existingDevice) {
      return {
        success: false,
        error: "Already joined from this device",
        errorCode: "ALREADY_JOINED",
        playerId: existingDevice.id,
      }
    }
  }

  const { data: nameRows } = await admin
    .from("players")
    .select("name")
    .eq("tournament_id", input.tournamentId)
  const nameLower = name.toLowerCase()
  if ((nameRows ?? []).some((r) => (r.name || "").trim().toLowerCase() === nameLower)) {
    return { success: false, error: "Name already taken", errorCode: "NAME_TAKEN" }
  }

  const playerId = input.playerId || crypto.randomUUID()
  const row = {
    id: playerId,
    tournament_id: input.tournamentId,
    name,
    user_id: input.isGuest ? null : input.userId || user?.id || null,
    is_guest: input.isGuest,
    points: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    games_played: 0,
    white_count: 0,
    black_count: 0,
    current_streak: 0,
    on_streak: false,
    paused: false,
    game_history: [],
    opponents: [],
    results: [],
    colors: [],
    points_earned: [],
    table_numbers: [],
    checked_in_at: input.checkedInAt,
    presence_source: input.presenceSource ?? null,
    rating: input.rating ?? null,
    device_id: deviceId,
    is_paused: false,
    is_removed: false,
  }

  const { error: insertError } = await admin.from("players").insert(row)
  if (insertError) {
    if ((insertError as { code?: string }).code === "23505") {
      return { success: false, error: "Already joined", errorCode: "ALREADY_JOINED" }
    }
    console.error("[joinTournamentAction] insert failed:", insertError)
    const { captureException } = await import("@/lib/sentry")
    captureException(insertError, { action: "joinTournament", tournamentId: input.tournamentId })
    return { success: false, error: "Failed to join", errorCode: "INSERT_FAILED" }
  }

  return { success: true, playerId }
}

/**
 * Load a tournament by id for join/arena clients.
 * Uses the signed-in user's RLS first; falls back to service role for private link access.
 */
export async function fetchTournamentById(tournamentId: string): Promise<TournamentData | null> {
  if (!tournamentId?.trim()) return null

  const supabase = await createClient()
  const { data: viaUser } = await supabase.from("tournaments").select("*").eq("id", tournamentId).maybeSingle()
  if (viaUser) return viaUser as TournamentData

  const admin = createAdminClient()
  if (!admin) return null

  const { data, error } = await admin.from("tournaments").select("*").eq("id", tournamentId).maybeSingle()
  if (error || !data) return null
  return data as TournamentData
}
