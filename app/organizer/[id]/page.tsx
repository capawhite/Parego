"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Loader2, MapPin, UserPlus, UserMinus } from "lucide-react"
import { LandingTournamentCard } from "@/components/landing-tournament-card"
import { useI18n } from "@/components/i18n-provider"
import {
  followOrganizer,
  getOrganizerProfile,
  isFollowingOrganizer,
  listTournamentsByOrganizer,
  unfollowOrganizer,
  type OrganizerProfile,
} from "@/lib/database/organizer-db"
import { getPlayerCounts, getPlayerPreviews, type TournamentData } from "@/lib/database/tournament-db"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export default function OrganizerPage() {
  const params = useParams()
  const organizerId = params.id as string
  const { t } = useI18n()

  const [profile, setProfile] = useState<OrganizerProfile | null>(null)
  const [upcoming, setUpcoming] = useState<TournamentData[]>([])
  const [recent, setRecent] = useState<TournamentData[]>([])
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({})
  const [playerPreviews, setPlayerPreviews] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [following, setFollowing] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!cancelled) setCurrentUserId(user?.id ?? null)

      const [p, open, all] = await Promise.all([
        getOrganizerProfile(organizerId),
        listTournamentsByOrganizer(organizerId, { includeCompleted: false, limit: 30 }),
        listTournamentsByOrganizer(organizerId, { includeCompleted: true, limit: 40 }),
      ])
      if (cancelled) return
      setProfile(p)
      setUpcoming(open)
      const completed = all.filter((t) => t.status === "completed").slice(0, 12)
      setRecent(completed)
      const ids = [...open, ...completed].map((t) => t.id)
      if (ids.length > 0) {
        const [counts, previews] = await Promise.all([getPlayerCounts(ids), getPlayerPreviews(ids, 5)])
        if (!cancelled) {
          setPlayerCounts(counts)
          setPlayerPreviews(previews)
        }
      }
      if (user) {
        const fol = await isFollowingOrganizer(organizerId)
        if (!cancelled) setFollowing(fol)
      }
      setLoading(false)
    }
    if (organizerId) void load()
    return () => {
      cancelled = true
    }
  }, [organizerId])

  const toggleFollow = async () => {
    if (!currentUserId) {
      toast.info(t("organizer.signInToFollow"))
      return
    }
    setFollowBusy(true)
    const result = following
      ? await unfollowOrganizer(organizerId)
      : await followOrganizer(organizerId)
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

  if (!profile) {
    return (
      <main className="min-h-svh p-6 max-w-3xl mx-auto space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("common.back")}
          </Link>
        </Button>
        <p className="text-muted-foreground">{t("organizer.notFound")}</p>
      </main>
    )
  }

  const canFollow = currentUserId !== organizerId

  return (
    <main className="min-h-svh bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <Button variant="ghost" size="sm" className="-ml-2" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("common.back")}
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight truncate">{profile.name}</h1>
            {(profile.city || profile.country || profile.federation) && (
              <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>{[profile.city, profile.country].filter(Boolean).join(", ")}</span>
                {profile.federation && (
                  <Badge variant="secondary" className="text-xs">
                    {profile.federation}
                  </Badge>
                )}
              </p>
            )}
            <p className="text-sm text-muted-foreground">{t("organizer.subtitle")}</p>
          </div>
          {canFollow && (
            <Button
              variant={following ? "outline" : "default"}
              className="shrink-0"
              disabled={followBusy}
              onClick={() => void toggleFollow()}
            >
              {following ? (
                <>
                  <UserMinus className="h-4 w-4 mr-2" />
                  {t("organizer.unfollow")}
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t("organizer.follow")}
                </>
              )}
            </Button>
          )}
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("organizer.upcomingTitle")}</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("organizer.noUpcoming")}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {upcoming.map((tour) => (
                <LandingTournamentCard
                  key={tour.id}
                  tournament={tour}
                  showDistance={false}
                  playerCount={playerCounts[tour.id] ?? 0}
                  playerNames={playerPreviews[tour.id] ?? []}
                  organizerName={profile.name}
                  organizerId={profile.id}
                />
              ))}
            </div>
          )}
        </section>

        {recent.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t("organizer.recentTitle")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recent.map((tour) => (
                <LandingTournamentCard
                  key={tour.id}
                  tournament={tour}
                  showDistance={false}
                  playerCount={playerCounts[tour.id] ?? 0}
                  playerNames={playerPreviews[tour.id] ?? []}
                  organizerName={profile.name}
                  organizerId={profile.id}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
