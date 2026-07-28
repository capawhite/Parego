import { createClient } from "@/lib/supabase/server"
import { parseTournamentSettings } from "@/lib/tournament-settings"

export type TournamentRow = {
  id: string
  name: string
  status: string
  settings?: unknown
  organizer_id?: string | null
  [key: string]: unknown
}

/** Server-side tournament load for RSC (uses cookie anon client, not browser client). */
export async function loadTournamentServer(tournamentId: string): Promise<TournamentRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("tournaments").select("*").eq("id", tournamentId).maybeSingle()
  if (error || !data) return null
  return data as TournamentRow
}

export { parseTournamentSettings }
