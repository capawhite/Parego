import { createClient } from "@/lib/supabase/client"
import type { Player, Match, TournamentSettings } from "@/lib/types"

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
      settings,
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
    console.error("[v0] Error saving tournament:", error)
    throw error
  }

  return data
}

// Load tournament from database
export async function loadTournament(tournamentId: string) {
  const supabase = createClient()

  const { data, error } = await supabase.from("tournaments").select("*").eq("id", tournamentId).maybeSingle() // Improved error handling for tournament loading

  if (error) {
    console.error("[v0] Error loading tournament:", error)
    return null
  }

  if (!data) {
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

  let query = supabase.from("tournaments").select("*")

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
    console.error("[v0] Error listing tournaments:", error)
    return []
  }

  return data as TournamentData[]
}

// Save players to database
export async function savePlayers(tournamentId: string, players: Player[]) {
  const supabase = createClient()

  const dbPlayers = players.map((player) => ({
    id: player.id,
    tournament_id: tournamentId,
    name: player.name,
    points: player.score,
    wins: player.gameResults.filter((r) => r === "W").length,
    draws: player.gameResults.filter((r) => r === "D").length,
    losses: player.gameResults.filter((r) => r === "L").length,
    games_played: player.gamesPlayed,
    white_count: player.pieceColors.filter((c) => c === "white").length,
    black_count: player.pieceColors.filter((c) => c === "black").length,
    current_streak: player.streak,
    on_streak: player.streak > 0,
    paused: player.paused,
    game_history: player.gameResults,
    opponents: player.opponentIds, // Map opponentIds to opponents
    results: player.gameResults,
    colors: player.pieceColors,
    points_earned: player.gameResults.map((r) => (r === "W" ? 2 : r === "D" ? 1 : 0)),
    table_numbers: player.tableNumbers || [],
  }))

  const { error } = await supabase.from("players").upsert(dbPlayers)

  if (error) {
    console.error("[v0] Error saving players:", error)
    throw error
  }
}

// Load players from database
export async function loadPlayers(tournamentId: string): Promise<Player[]> {
  const supabase = createClient()

  const { data, error } = await supabase.from("players").select("*").eq("tournament_id", tournamentId)

  if (error) {
    console.error("[v0] Error loading players:", error)
    return []
  }

  return data.map((p) => ({
    id: p.id,
    name: p.name,
    score: p.points || 0,
    gamesPlayed: p.games_played || 0,
    streak: p.current_streak || 0,
    performance: 0, // Calculated field, not stored
    active: !p.paused,
    paused: p.paused || false,
    joinedAt: new Date(p.created_at).getTime(),
    opponentIds: Array.isArray(p.opponents) ? p.opponents : [], // Ensure it's always an array
    gameResults: Array.isArray(p.results) ? p.results : [], // Ensure it's always an array
    pieceColors: Array.isArray(p.colors) ? p.colors : [], // Ensure it's always an array
    tableNumbers: Array.isArray(p.table_numbers) ? p.table_numbers : [], // Ensure it's always an array
  }))
}

// Save matches to database
export async function saveMatches(tournamentId: string, matches: Match[]) {
  const supabase = createClient()

  const dbMatches = matches.map((match) => ({
    id: match.id,
    tournament_id: tournamentId,
    player1_id: match.player1.id,
    player2_id: match.player2.id,
    player1_data: JSON.stringify(match.player1),
    player2_data: JSON.stringify(match.player2),
    table_number: match.tableNumber || null,
    result: match.result ? JSON.stringify(match.result) : null,
    completed: match.result?.completed || false,
    completed_at: match.result?.completedAt ? new Date(match.result.completedAt).toISOString() : null,
    player1_submission: match.player1Submission?.confirmed ? match.player1Submission.result : null,
    player2_submission: match.player2Submission?.confirmed ? match.player2Submission.result : null,
    player1_submission_time: match.player1Submission?.confirmed
      ? new Date(match.player1Submission.timestamp).toISOString()
      : null,
    player2_submission_time: match.player2Submission?.confirmed
      ? new Date(match.player2Submission.timestamp).toISOString()
      : null,
    dispute_status: match.disputeStatus || "none",
  }))

  const { error } = await supabase.from("matches").upsert(dbMatches)

  if (error) {
    console.error("[v0] Error saving matches:", error)
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
    console.error("[v0] Error loading matches:", error)
    return []
  }

  return data.map((m) => ({
    id: m.id,
    player1: m.player1_data ? JSON.parse(m.player1_data) : { id: m.player1_id, name: "Unknown" },
    player2: m.player2_data ? JSON.parse(m.player2_data) : { id: m.player2_id, name: "Unknown" },
    tableNumber: m.table_number,
    result: m.result ? JSON.parse(m.result) : undefined,
    player1Submission: m.player1_submission
      ? {
          result: m.player1_submission,
          timestamp: new Date(m.player1_submission_time).getTime(),
          confirmed: true,
        }
      : undefined,
    player2Submission: m.player2_submission
      ? {
          result: m.player2_submission,
          timestamp: new Date(m.player2_submission_time).getTime(),
          confirmed: true,
        }
      : undefined,
    disputeStatus: m.dispute_status || "none",
  }))
}

// Add a single player to an existing tournament
export async function addPlayerToTournament(tournamentId: string, playerName: string): Promise<Player | null> {
  const supabase = createClient()

  // First check if tournament exists and is active
  const tournament = await loadTournament(tournamentId)
  if (!tournament) {
    console.error("[v0] Tournament not found:", tournamentId)
    return null
  }

  // Create new player
  const newPlayer: Player = {
    id: globalThis.crypto.randomUUID(),
    name: playerName,
    score: 0,
    gamesPlayed: 0,
    streak: 0,
    performance: 0, // Calculated field, not stored
    active: true,
    paused: false,
    joinedAt: Date.now(),
    opponentIds: [],
    gameResults: [],
    pieceColors: [],
    tableNumbers: [],
  }

  // Save to database
  const { error } = await supabase.from("players").insert({
    id: newPlayer.id,
    tournament_id: tournamentId,
    name: newPlayer.name,
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
    opponents: [], // Initialize as empty array
    results: [],
    colors: [],
    points_earned: [],
    table_numbers: [],
  })

  if (error) {
    console.error("[v0] Error adding player:", error)
    return null
  }

  return newPlayer
}

export async function updateMatchSubmission(
  matchId: string,
  playerId: string,
  result: "player1-win" | "draw" | "player2-win",
  confirmed: boolean,
) {
  const supabase = createClient()

  const { data: match, error: fetchError } = await supabase.from("matches").select("*").eq("id", matchId).single()

  if (fetchError || !match) {
    console.error("[v0] Error fetching match:", fetchError)
    return null
  }

  const isPlayer1 = match.player1_id === playerId
  const submissionField = isPlayer1 ? "player1_submission" : "player2_submission"
  const timestampField = isPlayer1 ? "player1_submission_time" : "player2_submission_time"

  const { error } = await supabase
    .from("matches")
    .update({
      [submissionField]: confirmed ? result : null,
      [timestampField]: confirmed ? new Date().toISOString() : null,
    })
    .eq("id", matchId)

  if (error) {
    console.error("[v0] Error updating match submission:", error)
    return null
  }

  // Check if both players have submitted
  const { data: updatedMatch } = await supabase.from("matches").select("*").eq("id", matchId).single()

  return updatedMatch
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
    console.error("[v0] Error listing nearby tournaments:", error)
    return []
  }

  // Filter by actual distance (the SQL query uses a bounding box, this refines it to a circle)
  const filtered = (data as TournamentData[]).filter((t) => {
    if (!t.latitude || !t.longitude) return false
    const distance = haversineDistance(latitude, longitude, t.latitude, t.longitude)
    return distance <= radiusKm
  })

  // Sort by start_time (soonest first), then by distance
  return filtered.sort((a, b) => {
    // Prioritize tournaments with start times
    if (a.start_time && !b.start_time) return -1
    if (!a.start_time && b.start_time) return 1
    if (a.start_time && b.start_time) {
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    }
    // Fall back to distance
    const distA = haversineDistance(latitude, longitude, a.latitude!, a.longitude!)
    const distB = haversineDistance(latitude, longitude, b.latitude!, b.longitude!)
    return distA - distB
  })
}

// Haversine formula to calculate distance between two points
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
