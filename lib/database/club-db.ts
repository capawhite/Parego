import { createClient } from "@/lib/supabase/client"
import { formatSupabaseError, type TournamentData } from "@/lib/database/tournament-db"

export type Club = {
  id: string
  slug: string
  name: string
  description?: string | null
  city?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
  created_by?: string | null
  created_at?: string
}

export type ClubMemberRole = "owner" | "admin" | "member"

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

export function clubSlugFromName(name: string): string {
  const base = slugify(name)
  return base.length >= 2 ? base : `club-${Date.now().toString(36)}`
}

export async function getClubBySlug(slug: string): Promise<Club | null> {
  const supabase = createClient()
  const { data, error } = await supabase.from("clubs").select("*").eq("slug", slug).maybeSingle()
  if (error || !data) {
    if (error) console.error("[club-db] getClubBySlug:", formatSupabaseError(error))
    return null
  }
  return data as Club
}

export async function getClubById(id: string): Promise<Club | null> {
  const supabase = createClient()
  const { data, error } = await supabase.from("clubs").select("*").eq("id", id).maybeSingle()
  if (error || !data) {
    if (error) console.error("[club-db] getClubById:", formatSupabaseError(error))
    return null
  }
  return data as Club
}

export async function getClubsByIds(ids: string[]): Promise<Record<string, Club>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return {}
  const supabase = createClient()
  const { data, error } = await supabase.from("clubs").select("*").in("id", unique)
  if (error) {
    console.error("[club-db] getClubsByIds:", formatSupabaseError(error))
    return {}
  }
  const map: Record<string, Club> = {}
  for (const row of data ?? []) {
    map[row.id] = row as Club
  }
  return map
}

export async function searchClubs(query: string, limit = 20): Promise<Club[]> {
  const supabase = createClient()
  const q = query.trim()
  let builder = supabase.from("clubs").select("*").order("name", { ascending: true }).limit(limit)
  if (q) {
    builder = builder.or(`name.ilike.%${q}%,slug.ilike.%${q}%,city.ilike.%${q}%`)
  }
  const { data, error } = await builder
  if (error) {
    console.error("[club-db] searchClubs:", formatSupabaseError(error))
    return []
  }
  return (data as Club[]) ?? []
}

export async function listMyStaffClubs(): Promise<Club[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data: memberships, error: mErr } = await supabase
    .from("club_members")
    .select("club_id")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"])
  if (mErr) {
    console.error("[club-db] listMyStaffClubs members:", formatSupabaseError(mErr))
    return []
  }
  const ids = (memberships ?? []).map((m) => m.club_id)
  if (ids.length === 0) return []
  const { data, error } = await supabase.from("clubs").select("*").in("id", ids).order("name")
  if (error) {
    console.error("[club-db] listMyStaffClubs clubs:", formatSupabaseError(error))
    return []
  }
  return (data as Club[]) ?? []
}

export async function createClub(input: {
  name: string
  description?: string
  city?: string
  country?: string
  latitude?: number
  longitude?: number
}): Promise<{ ok: boolean; club?: Club; error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Sign in required" }

  const name = input.name.trim()
  if (name.length < 2) return { ok: false, error: "Name too short" }

  let slug = clubSlugFromName(name)
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? slug : `${slug.slice(0, 40)}-${attempt + 1}`
    const { data, error } = await supabase
      .from("clubs")
      .insert({
        name,
        slug: candidate,
        description: input.description?.trim() || null,
        city: input.city?.trim() || null,
        country: input.country?.trim() || null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        created_by: user.id,
      })
      .select("*")
      .single()

    if (!error && data) return { ok: true, club: data as Club }
    if (error?.code === "23505") continue
    return { ok: false, error: formatSupabaseError(error) }
  }
  return { ok: false, error: "Could not allocate a unique club URL" }
}

export async function listTournamentsByClub(
  clubId: string,
  opts?: { includeCompleted?: boolean; limit?: number },
): Promise<TournamentData[]> {
  const supabase = createClient()
  const limit = opts?.limit ?? 40
  let query = supabase
    .from("tournaments")
    .select("*")
    .eq("club_id", clubId)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (!opts?.includeCompleted) {
    query = query.in("status", ["setup", "active"])
  }
  const { data, error } = await query
  if (error) {
    console.error("[club-db] listTournamentsByClub:", formatSupabaseError(error))
    return []
  }
  return (data as TournamentData[]) ?? []
}

export async function getMyClubRole(clubId: string): Promise<ClubMemberRole | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle()
  return (data?.role as ClubMemberRole) ?? null
}

export async function isFollowingClub(clubId: string): Promise<boolean> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase
    .from("club_follows")
    .select("club_id")
    .eq("follower_id", user.id)
    .eq("club_id", clubId)
    .maybeSingle()
  return Boolean(data)
}

export async function followClub(clubId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Sign in required" }
  const { error } = await supabase.from("club_follows").upsert({
    follower_id: user.id,
    club_id: clubId,
  })
  if (error) return { ok: false, error: formatSupabaseError(error) }
  return { ok: true }
}

export async function unfollowClub(clubId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Sign in required" }
  const { error } = await supabase
    .from("club_follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("club_id", clubId)
  if (error) return { ok: false, error: formatSupabaseError(error) }
  return { ok: true }
}

export async function listFollowedClubs(limit = 20): Promise<Club[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data: follows, error: fErr } = await supabase
    .from("club_follows")
    .select("club_id")
    .eq("follower_id", user.id)
    .limit(limit)
  if (fErr) {
    console.error("[club-db] listFollowedClubs follows:", formatSupabaseError(fErr))
    return []
  }
  const ids = (follows ?? []).map((f) => f.club_id)
  if (ids.length === 0) return []
  const { data, error } = await supabase.from("clubs").select("*").in("id", ids).order("name")
  if (error) {
    console.error("[club-db] listFollowedClubs clubs:", formatSupabaseError(error))
    return []
  }
  return (data as Club[]) ?? []
}

export async function listTournamentsFromFollowedClubs(limit = 10): Promise<TournamentData[]> {
  const clubs = await listFollowedClubs(50)
  if (clubs.length === 0) return []
  const supabase = createClient()
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .in(
      "club_id",
      clubs.map((c) => c.id),
    )
    .eq("visibility", "public")
    .in("status", ["setup", "active"])
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) {
    console.error("[club-db] listTournamentsFromFollowedClubs:", formatSupabaseError(error))
    return []
  }
  return (data as TournamentData[]) ?? []
}
