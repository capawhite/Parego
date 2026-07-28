import { createClient } from "@/lib/supabase/client"
import { haversineKm } from "@/lib/geo"
import {
  mapDbPlayerRow,
  mapDbMatchRow,
  playerToDbRow,
  matchesToDbRows,
} from "@/lib/database/row-mappers"
import { parseTournamentSettings, settingsForPersistence } from "@/lib/tournament-settings"
import { DEFAULT_SETTINGS, type Player, type Match, type TournamentSettings } from "@/lib/types"

/** Extract readable message from Supabase/PostgrestError (whose props may be non-enumerable). */
export function formatSupabaseError(error: unknown): string {
  const err = error as Record<string, unknown>
  const msg = (err.message as string) ?? (error instanceof Error ? error.message : String(error))
  const code = (err.code as string) ?? ""
  const details = (err.details as string) ?? ""
  const hint = (err.hint as string) ?? ""
  return [msg, code ? `(${code})` : "", details || hint || ""].filter(Boolean).join(" ")
}

export interface TournamentData {
  id: string
  name: string
  status: "setup" | "active" | "completed"
  tables_count: number
  settings: TournamentSettings
  city?: string
  country?: string
  organizer_id?: string
  created_at?: string
  updated_at?: string
  latitude?: number
  longitude?: number
  visibility?: "public" | "private"
  start_time?: string
  presence_radius_m?: number | null // GPS check-in radius in meters; null = app default
  pairing_heartbeat_at?: string | null
}

// Save tournament to database
export async function saveTournament(
  tournamentId: string,
  name: string,
  status: "setup" | "active" | "completed",
  tablesCount: number,
  settings: TournamentSettings,
  city?: string,
  country?: string,
  organizerId?: string,
  latitude?: number,
  longitude?: number,
  visibility: "public" | "private" = "public",
  startTime?: string,
) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("tournaments")
    .upsert({
      id: tournamentId,
      name,
      status,
      tables_count: tablesCount,
      settings: settingsForPersistence(settings),
      city,
      country,
      organizer_id: organizerId,
      latitude,
      longitude,
      visibility,
      start_time: startTime,
      updated_at: new Date().toISOString(),
    })
    .select()

  if (error) {
    console.error("[v0] Error saving tournament:", formatSupabaseError(error))
    throw error
  }

  return data
}

// Load tournament from database
export async function loadTournament(tournamentId: string) {
  const supabase = createClient()

  const { data, error } = await supabase.from("tournaments").select("*").eq("id", tournamentId).maybeSingle() // Improved error handling for tournament loading

  if (error) {
    console.error("[v0] Error loading tournament:", formatSupabaseError(error))
    return null
  }

  if (!data) {
    if (process.env.NODE_ENV === "development")
      console.log("[v0] Tournament not found:", tournamentId)
    return null
  }

  return data as TournamentData
}

// List all tournaments (most recent first)
export async function listTournaments(
  limit = 10,
  filters?: {
    country?: string
    city?: string
    status?: "setup" | "active" | "completed"
  },
): Promise<TournamentData[]> {
  const supabase = createClient()

  let query = supabase.from("tournaments").select("*").eq("visibility", "public")

  if (filters?.country) {
    query = query.eq("country", filters.country)
  }
  if (filters?.city) {
    query = query.eq("city", filters.city)
  }
  if (filters?.status) {
    query = query.eq("status", filters.status)
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit)

  if (error) {
    console.error("[v0] Error listing tournaments:", formatSupabaseError(error))
    return []
  }

  return data as TournamentData[]
}

// Save players to database
export async function savePlayers(tournamentId: string, players: Player[], settings?: TournamentSettings) {
  const supabase = createClient()

  let scoringSettings: TournamentSettings = settings ?? { ...DEFAULT_SETTINGS }
  if (!settings) {
    const row = await loadTournament(tournamentId)
    scoringSettings = row ? parseTournamentSettings(row) : { ...DEFAULT_SETTINGS }
  }

  const dbPlayers = players.map((player) => playerToDbRow(tournamentId, player, scoringSettings))

  const { error } = await supabase.from("players").upsert(dbPlayers)

  if (error) {
    console.error("[v0] Error saving players:", formatSupabaseError(error))
    throw error
  }
}

/** Check if a display name already exists in the tournament (case-insensitive). Used for per-tournament uniqueness. */
export async function playerNameExistsInTournament(
  tournamentId: string,
  displayName: string,
): Promise<boolean> {
  const players = await loadPlayers(tournamentId)
  const nameLower = displayName.trim().toLowerCase()
  if (!nameLower) return false
  return players.some((p) => (p.name || "").trim().toLowerCase() === nameLower)
}

// Load players from database
export async function loadPlayers(tournamentId: string): Promise<Player[]> {
  const supabase = createClient()

  const { data, error } = await supabase.from("players").select("*").eq("tournament_id", tournamentId)

  if (error) {
    console.error("[v0] Error loading players:", formatSupabaseError(error))
    return []
  }

  return data.map(mapDbPlayerRow)
}

// Save matches to database
export async function saveMatches(tournamentId: string, matches: Match[]) {
  const supabase = createClient()

  const { error } = await supabase.from("matches").upsert(matchesToDbRows(tournamentId, matches))

  if (error) {
    console.error("[v0] Error saving matches:", formatSupabaseError(error))
    throw error
  }
}

// Load matches from database
export async function loadMatches(tournamentId: string): Promise<Match[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[v0] Error loading matches:", formatSupabaseError(error))
    return []
  }

  return data.map(mapDbMatchRow)
}

export async function listNearbyTournaments(
  latitude: number,
  longitude: number,
  radiusKm = 10,
  hoursAhead = 12,
  limit = 10,
): Promise<TournamentData[]> {
  const supabase = createClient()

  // Calculate time window
  const now = new Date()
  const futureTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000)

  // Simple distance calculation using lat/lon bounds
  // 1 degree latitude ≈ 111km, longitude varies by latitude
  const latDelta = radiusKm / 111
  const lonDelta = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180))

  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("visibility", "public")
    .in("status", ["setup", "active"])
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .gte("latitude", latitude - latDelta)
    .lte("latitude", latitude + latDelta)
    .gte("longitude", longitude - lonDelta)
    .lte("longitude", longitude + lonDelta)
    .or(`start_time.is.null,start_time.lte.${futureTime.toISOString()}`)
    .order("start_time", { ascending: true, nullsFirst: false })
    .limit(limit)

  if (error) {
    console.error("[v0] Error listing nearby tournaments:", formatSupabaseError(error))
    return []
  }

  // Filter by actual distance (the SQL query uses a bounding box, this refines it to a circle)
  const filtered = (data as TournamentData[]).filter((t) => {
    if (!t.latitude || !t.longitude) return false
    const distance = haversineKm(latitude, longitude, t.latitude, t.longitude)
    return distance <= radiusKm
  })

  // Sort by most recently created first, then soonest start time, then distance
  return filtered.sort((a, b) => {
    const createdA = (a.created_at && new Date(a.created_at).getTime()) || 0
    const createdB = (b.created_at && new Date(b.created_at).getTime()) || 0
    if (createdB !== createdA) return createdB - createdA // newest first
    if (a.start_time && !b.start_time) return -1
    if (!a.start_time && b.start_time) return 1
    if (a.start_time && b.start_time) {
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    }
    const distA = haversineKm(latitude, longitude, a.latitude!, a.longitude!)
    const distB = haversineKm(latitude, longitude, b.latitude!, b.longitude!)
    return distA - distB
  })
}

/** Batch: player count per tournament id */
export async function getPlayerCounts(tournamentIds: string[]): Promise<Record<string, number>> {
  if (tournamentIds.length === 0) return {}
  const supabase = createClient()
  const { data, error } = await supabase
    .from("players")
    .select("tournament_id")
    .in("tournament_id", tournamentIds)
  if (error) {
    console.error("[tournament-db] getPlayerCounts error:", error)
    return Object.fromEntries(tournamentIds.map((id) => [id, 0]))
  }
  const counts: Record<string, number> = {}
  for (const id of tournamentIds) counts[id] = 0
  for (const row of data ?? []) {
    counts[row.tournament_id] = (counts[row.tournament_id] ?? 0) + 1
  }
  return counts
}

/** Batch: first N player names per tournament (for preview on cards). Limit 5 per tournament. */
export async function getPlayerPreviews(
  tournamentIds: string[],
  limitPerTournament = 5
): Promise<Record<string, string[]>> {
  if (tournamentIds.length === 0) return {}
  const supabase = createClient()
  const { data, error } = await supabase
    .from("players")
    .select("tournament_id, name")
    .in("tournament_id", tournamentIds)
  if (error) {
    console.error("[tournament-db] getPlayerPreviews error:", error)
    return Object.fromEntries(tournamentIds.map((id) => [id, []]))
  }
  const byTournament: Record<string, string[]> = {}
  for (const id of tournamentIds) byTournament[id] = []
  for (const row of data ?? []) {
    const list = byTournament[row.tournament_id]
    if (list && list.length < limitPerTournament) list.push(row.name)
  }
  return byTournament
}

/** Fetch avatar URLs for given user IDs. Returns map of userId -> avatarUrl. */
export async function getAvatarUrls(userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) return {}
  const supabase = createClient()
  const { data, error } = await supabase
    .from("users")
    .select("id, avatar_url")
    .in("id", userIds)
  if (error) return {}
  const map: Record<string, string> = {}
  for (const row of data ?? []) {
    if (row.avatar_url) map[row.id] = row.avatar_url
  }
  return map
}
