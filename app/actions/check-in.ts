"use server"

import { createClient } from "@/lib/supabase/server"
import { haversineMeters } from "@/lib/geo"

const DEFAULT_PRESENCE_RADIUS_M = 150

export interface ProximityResult {
  ok: boolean
  error?: string
}

/**
 * Check if the given coordinates are within the tournament venue radius.
 * Does not require auth or an existing player. Use to gate join flow.
 */
export async function checkVenueProximity(
  tournamentId: string,
  latitude: number,
  longitude: number,
): Promise<ProximityResult> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, error: "Invalid coordinates" }
  }

  const supabase = await createClient()
  const { data: tournament, error: tError } = await supabase
    .from("tournaments")
    .select("latitude, longitude, presence_radius_m")
    .eq("id", tournamentId)
    .maybeSingle()

  if (tError || !tournament) {
    return { ok: false, error: "Tournament not found" }
  }

  const venueLat = tournament.latitude
  const venueLon = tournament.longitude
  if (venueLat == null || venueLon == null) {
    return { ok: true } // No venue set: allow (organizer can add location later; they can "Mark present")
  }

  const radiusM = tournament.presence_radius_m ?? DEFAULT_PRESENCE_RADIUS_M
  const distanceM = haversineMeters(venueLat, venueLon, latitude, longitude)
  if (distanceM > radiusM) {
    return {
      ok: false,
      error: `You're not at the venue (${Math.round(distanceM)} m away; need within ${radiusM} m). Get closer and try again.`,
    }
  }
  return { ok: true }
}

export interface VerifyAndCheckInResult {
  ok: boolean
  error?: string
}

/**
 * Verify user is within venue radius and set their player record as checked in (GPS).
 * User must be signed in and already a player in the tournament.
 */
export async function verifyAndCheckIn(
  tournamentId: string,
  latitude: number,
  longitude: number,
): Promise<VerifyAndCheckInResult> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, error: "Invalid coordinates" }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, error: "Sign in to check in" }
  }

  const { data: tournament, error: tError } = await supabase
    .from("tournaments")
    .select("latitude, longitude, presence_radius_m, organizer_id")
    .eq("id", tournamentId)
    .maybeSingle()

  if (tError || !tournament) {
    return { ok: false, error: "Tournament not found" }
  }

  const venueLat = tournament.latitude
  const venueLon = tournament.longitude
  if (venueLat == null || venueLon == null) {
    return { ok: false, error: "Venue location is not set. Ask the organizer to add it." }
  }

  const radiusM = tournament.presence_radius_m ?? DEFAULT_PRESENCE_RADIUS_M
  const distanceM = haversineMeters(venueLat, venueLon, latitude, longitude)
  if (distanceM > radiusM) {
    return {
      ok: false,
      error: `You're not at the venue (${Math.round(distanceM)} m away; need within ${radiusM} m). Get closer and try again.`,
    }
  }

  const { data: player, error: pError } = await supabase
    .from("players")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (pError || !player) {
    return { ok: false, error: "Join the tournament first, then check in." }
  }

  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from("players")
    .update({ checked_in_at: now, presence_source: "gps" })
    .eq("id", player.id)
    .eq("tournament_id", tournamentId)

  if (updateError) {
    console.error("[check-in] update error:", updateError)
    return { ok: false, error: "Could not save check-in" }
  }

  return { ok: true }
}

export interface MarkPresentOverrideResult {
  ok: boolean
  error?: string
}

/**
 * Organizer-only: mark a player as present (override, e.g. for edge cases).
 */
export async function markPresentOverride(
  tournamentId: string,
  playerId: string,
): Promise<MarkPresentOverrideResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, error: "Sign in required" }
  }

  const { data: tournament, error: tError } = await supabase
    .from("tournaments")
    .select("organizer_id")
    .eq("id", tournamentId)
    .maybeSingle()

  if (tError || !tournament || tournament.organizer_id !== user.id) {
    return { ok: false, error: "Only the organizer can mark players present" }
  }

  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from("players")
    .update({ checked_in_at: now, presence_source: "override" })
    .eq("id", playerId)
    .eq("tournament_id", tournamentId)

  if (updateError) {
    console.error("[check-in] markPresentOverride error:", updateError)
    return { ok: false, error: "Could not update player" }
  }

  return { ok: true }
}
