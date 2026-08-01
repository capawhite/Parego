import { createClient } from "@/lib/supabase/client"
import { formatSupabaseError, type TournamentData } from "@/lib/database/tournament-db"

export type OrganizerProfile = {
  id: string
  name: string
  city?: string | null
  country?: string | null
  avatarUrl?: string | null
}

export async function getOrganizerProfile(organizerId: string): Promise<OrganizerProfile | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("users")
    .select("id, name, city, country, avatar_url")
    .eq("id", organizerId)
    .maybeSingle()
  if (error || !data) {
    if (error) console.error("[organizer-db] getOrganizerProfile:", formatSupabaseError(error))
    return null
  }
  return {
    id: data.id,
    name: data.name,
    city: data.city,
    country: data.country,
    avatarUrl: data.avatar_url,
  }
}

export async function getOrganizerNames(userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) return {}
  const unique = [...new Set(userIds.filter(Boolean))]
  if (unique.length === 0) return {}
  const supabase = createClient()
  const { data, error } = await supabase.from("users").select("id, name").in("id", unique)
  if (error) {
    console.error("[organizer-db] getOrganizerNames:", formatSupabaseError(error))
    return {}
  }
  const map: Record<string, string> = {}
  for (const row of data ?? []) {
    if (row.name) map[row.id] = row.name
  }
  return map
}

export async function listTournamentsByOrganizer(
  organizerId: string,
  opts?: { includeCompleted?: boolean; limit?: number },
): Promise<TournamentData[]> {
  const supabase = createClient()
  const limit = opts?.limit ?? 40
  let query = supabase
    .from("tournaments")
    .select("*")
    .eq("organizer_id", organizerId)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (!opts?.includeCompleted) {
    query = query.in("status", ["setup", "active"])
  }

  const { data, error } = await query
  if (error) {
    console.error("[organizer-db] listTournamentsByOrganizer:", formatSupabaseError(error))
    return []
  }
  return (data as TournamentData[]) ?? []
}

export async function isFollowingOrganizer(organizerId: string): Promise<boolean> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase
    .from("organizer_follows")
    .select("organizer_id")
    .eq("follower_id", user.id)
    .eq("organizer_id", organizerId)
    .maybeSingle()
  return Boolean(data)
}

export async function followOrganizer(organizerId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Sign in required" }
  if (user.id === organizerId) return { ok: false, error: "Cannot follow yourself" }
  const { error } = await supabase.from("organizer_follows").upsert({
    follower_id: user.id,
    organizer_id: organizerId,
  })
  if (error) return { ok: false, error: formatSupabaseError(error) }
  return { ok: true }
}

export async function unfollowOrganizer(organizerId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Sign in required" }
  const { error } = await supabase
    .from("organizer_follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("organizer_id", organizerId)
  if (error) return { ok: false, error: formatSupabaseError(error) }
  return { ok: true }
}

export async function listFollowedOrganizerIds(): Promise<string[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from("organizer_follows")
    .select("organizer_id")
    .eq("follower_id", user.id)
  if (error) {
    console.error("[organizer-db] listFollowedOrganizerIds:", formatSupabaseError(error))
    return []
  }
  return (data ?? []).map((r) => r.organizer_id)
}

export async function listTournamentsFromFollowedOrganizers(limit = 10): Promise<TournamentData[]> {
  const ids = await listFollowedOrganizerIds()
  if (ids.length === 0) return []
  const supabase = createClient()
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .in("organizer_id", ids)
    .eq("visibility", "public")
    .in("status", ["setup", "active"])
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) {
    console.error("[organizer-db] listTournamentsFromFollowedOrganizers:", formatSupabaseError(error))
    return []
  }
  return (data as TournamentData[]) ?? []
}
