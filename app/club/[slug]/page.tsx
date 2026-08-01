"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2, MapPin, Plus, UserMinus, UserPlus } from "lucide-react"
import { LandingTournamentCard } from "@/components/landing-tournament-card"
import { useI18n } from "@/components/i18n-provider"
import { getOrganizerNames } from "@/lib/database/organizer-db"
import {
  followClub,
  getClubBySlug,
  getMyClubRole,
  isFollowingClub,
  listTournamentsByClub,
  unfollowClub,
  type Club,
  type ClubMemberRole,
} from "@/lib/database/club-db"
import { getPlayerCounts, getPlayerPreviews, type TournamentData } from "@/lib/database/tournament-db"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export default function ClubPage() {
  const params = useParams()
  const slug = params.slug as string
  const router = useRouter()
  const { t } = useI18n()

  const [club, setClub] = useState<Club | null>(null)
  const [upcoming, setUpcoming] = useState<TournamentData[]>([])
  const [recent, setRecent] = useState<TournamentData[]>([])
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({})
  const [playerPreviews, setPlayerPreviews] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<ClubMemberRole | null>(null)
  const [following, setFollowing] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [organizerNames, setOrganizerNames] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const c = await getClubBySlug(slug)
      if (cancelled) return
      setClub(c)
      if (!c) {
        setLoading(false)
        return
      }
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!cancelled) setSignedIn(Boolean(user))

      const [open, all, myRole, fol] = await Promise.all([
        listTournamentsByClub(c.id, { includeCompleted: false }),
        listTournamentsByClub(c.id, { includeCompleted: true }),
        getMyClubRole(c.id),
        user ? isFollowingClub(c.id) : Promise.resolve(false),
      ])
      if (cancelled) return
      setUpcoming(open)
      setRecent(all.filter((t) => t.status === "completed").slice(0, 12))
      setRole(myRole)
      setFollowing(fol)
      const recentCompleted = all.filter((t) => t.status === "completed").slice(0, 12)
      const ids = [...open, ...recentCompleted].map((x) => x.id)
      const orgIds = [...open, ...recentCompleted]
        .map((x) => x.organizer_id)
        .filter((id): id is string => Boolean(id))
      if (ids.length > 0 || orgIds.length > 0) {
        const [counts, previews, names] = await Promise.all([
          ids.length > 0 ? getPlayerCounts(ids) : Promise.resolve({}),
          ids.length > 0 ? getPlayerPreviews(ids, 5) : Promise.resolve({}),
          orgIds.length > 0 ? getOrganizerNames(orgIds) : Promise.resolve({}),
        ])
        if (!cancelled) {
          setPlayerCounts(counts)
          setPlayerPreviews(previews)
          setOrganizerNames(names)
        }
      }
      setLoading(false)
    }
    if (slug) void load()
    return () => {
      cancelled = true
    }
  }, [slug])

  const toggleFollow = async () => {
    if (!club) return
    if (!signedIn) {
      toast.info(t("club.signInToFollow"))
      return
    }
    setFollowBusy(true)
    const result = following ? await unfollowClub(club.id) : await followClub(club.id)
    setFollowBusy(false)
    if (!result.ok) {
      toast.error(result.error || t("common.errorGeneric"))
      return
    }
    setFollowing(!following)
  }

  if (loading) {
    return (
      <main className="min-h-svh flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    )
  }

  if (!club) {
    return (
      <main className="min-h-svh p-6 max-w-3xl mx-auto space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("common.back")}
          </Link>
        </Button>
        <p className="text-muted-foreground">{t("club.notFound")}</p>
      </main>
    )
  }

  const isStaff = role === "owner" || role === "admin"

  return (
    <main className="min-h-svh bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <Button variant="ghost" size="sm" className="-ml-2" asChild>
              <Link href="/clubs">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("club.backToClubs")}
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight truncate">{club.name}</h1>
            {(club.city || club.country) && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {[club.city, club.country].filter(Boolean).join(", ")}
              </p>
            )}
            {club.description ? (
              <p className="text-sm text-muted-foreground max-w-prose">{club.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("club.defaultDescription")}</p>
            )}
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            {isStaff && (
              <Button onClick={() => router.push(`/create?club=${club.id}`)}>
                <Plus className="h-4 w-4 mr-2" />
                {t("club.createEvent")}
              </Button>
            )}
            <Button
              variant={following ? "outline" : "secondary"}
              disabled={followBusy}
              onClick={() => void toggleFollow()}
            >
              {following ? (
                <>
                  <UserMinus className="h-4 w-4 mr-2" />
                  {t("club.unfollow")}
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t("club.follow")}
                </>
              )}
            </Button>
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("club.upcomingTitle")}</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("club.noUpcoming")}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {upcoming.map((tour) => (
                <LandingTournamentCard
                  key={tour.id}
                  tournament={tour}
                  showDistance={false}
                  playerCount={playerCounts[tour.id] ?? 0}
                  playerNames={playerPreviews[tour.id] ?? []}
                  clubName={club.name}
                  clubSlug={club.slug}
                  organizerId={tour.organizer_id}
                  organizerName={tour.organizer_id ? organizerNames[tour.organizer_id] : null}
                />
              ))}
            </div>
          )}
        </section>

        {recent.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t("club.recentTitle")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recent.map((tour) => (
                <LandingTournamentCard
                  key={tour.id}
                  tournament={tour}
                  showDistance={false}
                  playerCount={playerCounts[tour.id] ?? 0}
                  playerNames={playerPreviews[tour.id] ?? []}
                  clubName={club.name}
                  clubSlug={club.slug}
                  organizerId={tour.organizer_id}
                  organizerName={tour.organizer_id ? organizerNames[tour.organizer_id] : null}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
