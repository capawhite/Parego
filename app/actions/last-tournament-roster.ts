"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient, adminClientMissingReason } from "@/lib/supabase/admin"

export type LastRosterPlayer = {
  name: string
  userId: string | null
  rating: number | null
  isGuest: boolean
}

export type LastTournamentRosterResult = {
  success: boolean
  error?: string
  tournamentId?: string
  tournamentName?: string
  players?: LastRosterPlayer[]
}

/**
 * Return players from the organizer's most recent other tournament
 * (for "add from last event" roster reuse).
 */
export async function getLastTournamentRoster(
  excludeTournamentId: string,
): Promise<LastTournamentRosterResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: "Sign in required" }
  }

  const admin = createAdminClient()
  if (!admin) {
    return { success: false, error: adminClientMissingReason() }
  }

  const { data: previous, error: tErr } = await admin
    .from("tournaments")
    .select("id, name, created_at")
    .or(`organizer_id.eq.${user.id},owner_id.eq.${user.id}`)
    .neq("id", excludeTournamentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (tErr) {
    console.error("[last-tournament-roster] tournament lookup:", tErr)
    return { success: false, error: "Could not load previous tournament" }
  }
  if (!previous) {
    return { success: true, players: [] }
  }

  const { data: rows, error: pErr } = await admin
    .from("players")
    .select("name, user_id, rating, is_guest, is_removed")
    .eq("tournament_id", previous.id)
    .order("created_at", { ascending: true })

  if (pErr) {
    console.error("[last-tournament-roster] players lookup:", pErr)
    return { success: false, error: "Could not load previous players" }
  }

  const seen = new Set<string>()
  const players: LastRosterPlayer[] = []
  for (const row of rows ?? []) {
    if (row.is_removed) continue
    const name = typeof row.name === "string" ? row.name.trim() : ""
    if (!name) continue
    const key = row.user_id ? `u:${row.user_id}` : `n:${name.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    players.push({
      name,
      userId: row.user_id ?? null,
      rating: typeof row.rating === "number" ? row.rating : null,
      isGuest: row.is_guest !== false && !row.user_id,
    })
  }

  return {
    success: true,
    tournamentId: previous.id,
    tournamentName: previous.name,
    players,
  }
}
