import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { parseTournamentSettings } from "@/lib/tournament-settings"

export type TournamentRow = {
  id: string
  name: string
  status: string
  settings?: unknown
  organizer_id?: string | null
  [key: string]: unknown
}

/**
 * Server-side tournament load for RSC.
 * Cookie client first (respects RLS); service-role fallback so private join links work for guests.
 */
export async function loadTournamentServer(tournamentId: string): Promise<TournamentRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from("tournaments").select("*").eq("id", tournamentId).maybeSingle()
  if (!error && data) return data as TournamentRow

  const admin = createAdminClient()
  if (!admin) return null
  const { data: adminData, error: adminError } = await admin
    .from("tournaments")
    .select("*")
    .eq("id", tournamentId)
    .maybeSingle()
  if (adminError || !adminData) return null
  return adminData as TournamentRow
}

export { parseTournamentSettings }
