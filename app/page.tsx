"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Zap, MapPin, Hash, User, LogOut, Plus, AlertCircle, Compass, Loader2, RefreshCw, QrCode, Swords, Users } from "lucide-react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import {
  listNearbyTournaments,
  listOpenTournaments,
  listRecentCompletedTournaments,
  isDiscoverableTournament,
  getPlayerCounts,
  getPlayerPreviews,
  type TournamentData,
} from "@/lib/database/tournament-db"
import {
  getOrganizerNames,
  listTournamentsFromFollowedOrganizers,
} from "@/lib/database/organizer-db"
import {
  getClubsByIds,
  listFollowedClubs,
  listTournamentsFromFollowedClubs,
  type Club,
} from "@/lib/database/club-db"
import { LandingTournamentCard } from "@/components/landing-tournament-card"
import { toast } from "sonner"
import { useI18n } from "@/components/i18n-provider"
import { haversineKm } from "@/lib/geo"
import { hasPriorGuestSessions } from "@/lib/guest-session-history"

const NEARBY_RADIUS_KM = 15
const NEARBY_HOURS = 168 // 7 days on home
const FALLBACK_LIST_LIMIT = 8
const HISTORY_LIMIT = 6

function formatNearbyDistance(km: number, t: (path: string, params?: Record<string, string | number>) => string): string {
  if (km < 1) return t("landing.distanceMeters", { meters: Math.round(km * 1000) })
  return t("landing.distanceKilometers", { kilometers: Number(km.toFixed(1)) })
}

export default function Home() {
  const router = useRouter()
  const { t } = useI18n()
  const [joinCode, setJoinCode] = useState("")
  const [showCodeInput, setShowCodeInput] = useState(false)

  const [user, setUser] = useState<{ id: string; name: string } | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)

  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState<"pending" | "granted" | "denied" | "unsupported">("pending")
  const [nearbyTournaments, setNearbyTournaments] = useState<TournamentData[]>([])
  const [fallbackTournaments, setFallbackTournaments] = useState<TournamentData[]>([])
  const [historyTournaments, setHistoryTournaments] = useState<TournamentData[]>([])
  const [loadingNearby, setLoadingNearby] = useState(false)
  const [loadingFallback, setLoadingFallback] = useState(false)
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({})
  const [playerPreviews, setPlayerPreviews] = useState<Record<string, string[]>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [showGuestBanner, setShowGuestBanner] = useState(false)
  const [organizerNames, setOrganizerNames] = useState<Record<string, string>>({})
  const [clubsById, setClubsById] = useState<Record<string, Club>>({})
  const [followingTournaments, setFollowingTournaments] = useState<TournamentData[]>([])
  const [followedClubs, setFollowedClubs] = useState<Club[]>([])
  const [clubEventTournaments, setClubEventTournaments] = useState<TournamentData[]>([])

  useEffect(() => {
    const supabase = createClient()

    async function checkAuth() {
      try {
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError) {
          if (authError.message.includes("User from sub claim") || authError.message.includes("user_not_found")) {
            await supabase.auth.signOut()
            setUser(null)
            setLoadingAuth(false)
            return
          }
        }

        if (authUser) {
          const userName = authUser.user_metadata?.name
          if (userName) {
            setUser({ id: authUser.id, name: userName })
          } else {
            const { data: profile } = await supabase.from("users").select("name").eq("id", authUser.id).maybeSingle()
            if (profile?.name) {
              setUser({ id: authUser.id, name: profile.name })
            }
          }
        }
      } catch (error) {
        console.error("[v0] Error checking auth:", error)
        await supabase.auth.signOut()
        setUser(null)
      } finally {
        setLoadingAuth(false)
      }
    }

    checkAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const userName = session.user.user_metadata?.name
        if (userName) {
          setUser({ id: session.user.id, name: userName })
        }
        setLoadingAuth(false)
      } else {
        setUser(null)
        setLoadingAuth(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (loadingAuth || user) {
      setShowGuestBanner(false)
      return
    }
    setShowGuestBanner(hasPriorGuestSessions())
  }, [loadingAuth, user])

  useEffect(() => {
    if (loadingAuth || !user) {
      setFollowingTournaments([])
      setFollowedClubs([])
      setClubEventTournaments([])
      return
    }
    let cancelled = false
    Promise.all([
      listTournamentsFromFollowedOrganizers(8),
      listFollowedClubs(8),
      listTournamentsFromFollowedClubs(8),
    ]).then(([orgEvents, clubs, clubEvents]) => {
      if (cancelled) return
      setFollowingTournaments(orgEvents.filter((t) => isDiscoverableTournament(t)))
      setFollowedClubs(clubs)
      setClubEventTournaments(clubEvents.filter((t) => isDiscoverableTournament(t)))
    })
    return () => {
      cancelled = true
    }
  }, [loadingAuth, user])

  // Request location and load nearby or fallback tournaments
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("unsupported")
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        })
        setLocationStatus("granted")
      },
      () => {
        setLocationStatus("denied")
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
    )
  }, [])

  useEffect(() => {
    if (locationStatus !== "granted" || !userLocation) return

    let cancelled = false
    setLoadingNearby(true)
    listNearbyTournaments(userLocation.lat, userLocation.lon, NEARBY_RADIUS_KM, NEARBY_HOURS, 10)
      .then((data) => {
        if (!cancelled) setNearbyTournaments(data)
      })
      .finally(() => {
        if (!cancelled) setLoadingNearby(false)
      })
    return () => {
      cancelled = true
    }
  }, [locationStatus, userLocation])

  useEffect(() => {
    if (locationStatus !== "denied" && locationStatus !== "unsupported") return

    let cancelled = false
    setLoadingFallback(true)
    listOpenTournaments(FALLBACK_LIST_LIMIT)
      .then((data) => {
        if (!cancelled) setFallbackTournaments(data)
      })
      .finally(() => {
        if (!cancelled) setLoadingFallback(false)
      })
    return () => {
      cancelled = true
    }
  }, [locationStatus])

  // Recent completed events (history) — always available, independent of GPS
  useEffect(() => {
    let cancelled = false
    listRecentCompletedTournaments(HISTORY_LIMIT, 30).then((data) => {
      if (!cancelled) setHistoryTournaments(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Refetch tournaments (used by periodic refresh, manual button, and tab focus)
  const refreshTournaments = useCallback(async () => {
    setRefreshing(true)
    try {
      if (locationStatus === "granted" && userLocation) {
        const data = await listNearbyTournaments(userLocation.lat, userLocation.lon, NEARBY_RADIUS_KM, NEARBY_HOURS, 10)
        setNearbyTournaments(data)
      } else if (locationStatus === "denied" || locationStatus === "unsupported") {
        const data = await listOpenTournaments(FALLBACK_LIST_LIMIT)
        setFallbackTournaments(data)
      }
      const history = await listRecentCompletedTournaments(HISTORY_LIMIT, 30)
      setHistoryTournaments(history)
    } finally {
      setRefreshing(false)
    }
  }, [locationStatus, userLocation])

  // Periodic refresh so new tournaments appear without reload (e.g. organizer just created one)
  const REFRESH_INTERVAL_MS = 45_000
  useEffect(() => {
    if (locationStatus === "pending") return
    const id = setInterval(refreshTournaments, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [refreshTournaments, locationStatus])

  // Refetch when user returns to the tab
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible" && locationStatus !== "pending") refreshTournaments()
    }
    document.addEventListener("visibilitychange", onFocus)
    return () => document.removeEventListener("visibilitychange", onFocus)
  }, [refreshTournaments, locationStatus])

  const showNearby = locationStatus === "granted" && userLocation
  const showFallback = (locationStatus === "denied" || locationStatus === "unsupported") && !showNearby
  const hasNearbyList = showNearby && nearbyTournaments.length > 0
  const hasFallbackList = showFallback && fallbackTournaments.length > 0

  const singleNearby =
    showNearby && !loadingNearby && nearbyTournaments.length === 1 ? nearbyTournaments[0] : null
  const singleNearbyDistanceKm =
    singleNearby && userLocation && singleNearby.latitude != null && singleNearby.longitude != null
      ? haversineKm(userLocation.lat, userLocation.lon, singleNearby.latitude, singleNearby.longitude)
      : null

  // Load player counts and previews when tournament list changes
  const displayedTournaments = showNearby ? nearbyTournaments : fallbackTournaments
  const previewTournamentIds = useMemo(
    () =>
      [
        ...displayedTournaments,
        ...followingTournaments,
        ...clubEventTournaments,
        ...historyTournaments,
      ].map((t) => t.id),
    [displayedTournaments, followingTournaments, clubEventTournaments, historyTournaments],
  )
  useEffect(() => {
    if (previewTournamentIds.length === 0) return
    let cancelled = false
    Promise.all([
      getPlayerCounts(previewTournamentIds),
      getPlayerPreviews(previewTournamentIds, 5),
    ]).then(([counts, previews]) => {
      if (!cancelled) {
        setPlayerCounts(counts)
        setPlayerPreviews(previews)
      }
    })
    return () => {
      cancelled = true
    }
  }, [previewTournamentIds])

  useEffect(() => {
    const orgIds = [
      ...displayedTournaments,
      ...followingTournaments,
      ...clubEventTournaments,
      ...historyTournaments,
    ]
      .map((t) => t.organizer_id)
      .filter((id): id is string => Boolean(id))
    const clubIds = [
      ...displayedTournaments,
      ...followingTournaments,
      ...clubEventTournaments,
      ...historyTournaments,
    ]
      .map((t) => t.club_id)
      .filter((id): id is string => Boolean(id))
    let cancelled = false
    Promise.all([
      orgIds.length > 0 ? getOrganizerNames(orgIds) : Promise.resolve({}),
      clubIds.length > 0 ? getClubsByIds(clubIds) : Promise.resolve({}),
    ]).then(([names, clubs]) => {
      if (cancelled) return
      setOrganizerNames(names)
      setClubsById(clubs)
    })
    return () => {
      cancelled = true
    }
  }, [displayedTournaments, followingTournaments, clubEventTournaments, historyTournaments])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    router.refresh()
  }

  const handleJoinWithCode = () => {
    if (!joinCode.trim()) return
    const code = joinCode.trim().toUpperCase()
    router.push(`/join/${code}`)
  }

  return (
    <main className="relative min-h-svh overflow-x-hidden">
      {/* Soft brand atmosphere (behind content) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] bg-[radial-gradient(ellipse_at_top,hsl(263_76%_57%/0.12),transparent_55%)]"
      />

      <header className="relative z-10 flex items-center justify-end gap-3 p-4">
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Button variant="ghost" size="sm" className="min-h-10" asChild>
            <Link href="/clubs">{t("home.clubsLink")}</Link>
          </Button>
          {loadingAuth ? (
            <span className="text-sm text-muted-foreground">{t("common.loading")}</span>
          ) : user ? (
            <>
              <Button variant="ghost" size="sm" className="min-h-10 min-w-10" asChild>
                <Link href="/profile" className="flex items-center gap-2">
                  <User className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline max-w-[100px] truncate">{user.name}</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" className="min-h-10 min-w-10" onClick={handleLogout}>
                <LogOut className="h-4 w-4 shrink-0 sm:mr-2" />
                <span className="hidden sm:inline">{t("home.logout")}</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="min-h-10" asChild>
                <Link href="/auth/login">{t("home.loginButton")}</Link>
              </Button>
              <Button variant="default" size="sm" className="min-h-10 bg-primary hover:bg-primary/90" asChild>
                <Link href="/auth/signup">{t("home.signUp")}</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pb-16 space-y-10">
        {/* First viewport: brand + one line + CTAs */}
        <section className="pt-6 sm:pt-10 space-y-6 text-center">
          <div className="space-y-3">
            <Link href="/" className="inline-flex items-center justify-center gap-3">
              <Zap className="h-12 w-12 sm:h-14 sm:w-14 text-primary" strokeWidth={2.5} fill="currentColor" />
              <h1 className="text-5xl sm:text-6xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Parego
              </h1>
            </Link>
            <p className="text-muted-foreground text-base sm:text-lg max-w-md mx-auto">
              {t("home.subheadline")}
            </p>
            {!loadingAuth && !user && (
              <p className="text-primary text-sm font-medium">{t("home.registerToCreate")}</p>
            )}
          </div>

          {showGuestBanner && (
            <div className="max-w-xl mx-auto rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 text-left">
              <p className="text-sm flex-1">{t("home.guestAccountBanner")}</p>
              <Button size="sm" className="shrink-0" asChild>
                <Link href="/auth/signup?from=conversion&skipRating=1">{t("home.guestAccountBannerCta")}</Link>
              </Button>
            </div>
          )}

          {singleNearby && singleNearbyDistanceKm != null && (
            <div className="max-w-xl mx-auto rounded-lg border-2 border-primary/30 bg-background/90 p-4 space-y-3 text-left shadow-sm">
              <p className="text-sm font-medium">
                {t("home.nearbyJoinCta", {
                  name: singleNearby.name,
                  distance: formatNearbyDistance(singleNearbyDistanceKm, t),
                })}
              </p>
              <Button className="w-full h-12 font-semibold bg-primary hover:bg-primary/90" asChild>
                <Link href={`/j/${singleNearby.id}`}>
                  <MapPin className="h-4 w-4 mr-2 shrink-0" />
                  {t("home.nearbyJoinButton")}
                </Link>
              </Button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto text-left">
            {user && (
              <Button
                className="sm:flex-1 h-12 font-semibold bg-primary hover:bg-primary/90"
                asChild
              >
                <Link href="/create">
                  <Plus className="h-4 w-4 mr-2 shrink-0" />
                  {t("home.ctaCreate")}
                </Link>
              </Button>
            )}
            <div className="sm:flex-1 flex flex-col rounded-md border-2 border-input bg-background/80 hover:border-primary transition-colors overflow-hidden">
              {showCodeInput ? (
                <div className="p-4 space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder={t("home.enterTournamentCode")}
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleJoinWithCode()
                        if (e.key === "Escape") {
                          setShowCodeInput(false)
                          setJoinCode("")
                        }
                      }}
                      className="text-center font-mono tracking-widest uppercase"
                      maxLength={8}
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowCodeInput(false)
                        setJoinCode("")
                      }}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      className="flex-1 bg-primary hover:bg-primary/90"
                      onClick={handleJoinWithCode}
                      disabled={!joinCode.trim()}
                    >
                      {t("home.joinButton")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-md border-0 bg-transparent hover:bg-primary/5 font-semibold justify-start px-4 shadow-none"
                  onClick={() => setShowCodeInput(true)}
                >
                  <Hash className="h-4 w-4 mr-2 shrink-0" strokeWidth={2.5} />
                  <span className="truncate">{t("home.ctaJoin")}</span>
                  <span className="text-muted-foreground font-normal text-sm ml-1.5 hidden sm:inline truncate">
                    — {t("home.enterCodeOrQr")}
                  </span>
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Tournament discovery */}
        <section className="space-y-4">
          {(followingTournaments.length > 0 || followedClubs.length > 0 || clubEventTournaments.length > 0) && (
            <div className="space-y-4">
              {followedClubs.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-muted-foreground">{t("home.followedClubsTitle")}</p>
                    <Link href="/clubs" className="text-sm text-primary hover:underline">
                      {t("home.browseClubs")}
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {followedClubs.map((c) => (
                      <Button key={c.id} variant="outline" size="sm" asChild>
                        <Link href={`/club/${c.slug}`}>
                          <Users className="h-3.5 w-3.5 mr-1.5" />
                          {c.name}
                        </Link>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {(followingTournaments.length > 0 || clubEventTournaments.length > 0) && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">{t("home.followingEventsTitle")}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[...clubEventTournaments, ...followingTournaments]
                      .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
                      .slice(0, 6)
                      .map((tour) => (
                        <LandingTournamentCard
                          key={`fol-${tour.id}`}
                          tournament={tour}
                          userCoords={userLocation}
                          showDistance={Boolean(userLocation)}
                          playerCount={playerCounts[tour.id] ?? 0}
                          playerNames={playerPreviews[tour.id] ?? []}
                          organizerId={tour.organizer_id}
                          organizerName={tour.organizer_id ? organizerNames[tour.organizer_id] : null}
                          clubName={tour.club_id ? clubsById[tour.club_id]?.name : null}
                          clubSlug={tour.club_id ? clubsById[tour.club_id]?.slug : null}
                        />
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {locationStatus === "pending" && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Compass className="h-8 w-8 text-primary animate-pulse" />
              <p className="font-medium">{t("home.gettingLocation")}</p>
              <p className="text-sm text-muted-foreground max-w-sm">{t("home.gettingLocationHint")}</p>
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {showNearby && (
            <>
              {loadingNearby ? (
                <div className="flex flex-col items-center gap-2 py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">{t("home.searchingNearby")}</p>
                </div>
              ) : hasNearbyList ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("home.withinKmPeriod", { km: NEARBY_RADIUS_KM, period: t("home.periodWeek") })}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link href="/nearby" className="text-sm text-primary hover:underline">
                        {t("home.adjustDistanceTime")}
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => refreshTournaments()}
                        disabled={refreshing}
                      >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {nearbyTournaments.map((tour) => (
                      <LandingTournamentCard
                        key={tour.id}
                        tournament={tour}
                        userCoords={userLocation}
                        showDistance={true}
                        playerCount={playerCounts[tour.id] ?? 0}
                        playerNames={playerPreviews[tour.id] ?? []}
                        organizerId={tour.organizer_id}
                        organizerName={tour.organizer_id ? organizerNames[tour.organizer_id] : null}
                        clubName={tour.club_id ? clubsById[tour.club_id]?.name : null}
                        clubSlug={tour.club_id ? clubsById[tour.club_id]?.slug : null}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <MapPin className="h-8 w-8 text-muted-foreground" />
                  <p className="font-medium">{t("home.noTournamentsNearby")}</p>
                  <p className="text-sm text-muted-foreground">{t("home.noTournamentsHint")}</p>
                  <Button variant="outline" size="sm" asChild className="mt-1">
                    <Link href="/nearby">{t("home.adjustDistanceTime")}</Link>
                  </Button>
                </div>
              )}
            </>
          )}

          {showFallback && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">{t("home.locationOff")}</p>
                  <p className="text-sm text-muted-foreground">{t("home.locationOffHint")}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="self-start" asChild>
                <Link href="/nearby">{t("home.tryFindNearby")}</Link>
              </Button>
            </div>
          )}

          {hasFallbackList && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-muted-foreground">{t("home.openTournaments")}</h2>
                <div className="flex items-center gap-2 shrink-0">
                  <Link href="/nearby" className="text-sm text-primary hover:underline">
                    {t("home.findNearby")}
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => refreshTournaments()}
                    disabled={refreshing}
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {fallbackTournaments.map((tour) => (
                  <LandingTournamentCard
                    key={tour.id}
                    tournament={tour}
                    userCoords={null}
                    showDistance={false}
                    playerCount={playerCounts[tour.id] ?? 0}
                    playerNames={playerPreviews[tour.id] ?? []}
                    organizerId={tour.organizer_id}
                    organizerName={tour.organizer_id ? organizerNames[tour.organizer_id] : null}
                    clubName={tour.club_id ? clubsById[tour.club_id]?.name : null}
                    clubSlug={tour.club_id ? clubsById[tour.club_id]?.slug : null}
                  />
                ))}
              </div>
            </div>
          )}

          {historyTournaments.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-border/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-muted-foreground">{t("home.historyTitle")}</h2>
                <p className="text-xs text-muted-foreground">{t("home.historyHint")}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-90">
                {historyTournaments.map((tour) => (
                  <LandingTournamentCard
                    key={`hist-${tour.id}`}
                    tournament={tour}
                    userCoords={userLocation}
                    showDistance={Boolean(userLocation)}
                    playerCount={playerCounts[tour.id] ?? 0}
                    playerNames={playerPreviews[tour.id] ?? []}
                    organizerId={tour.organizer_id}
                    organizerName={tour.organizer_id ? organizerNames[tour.organizer_id] : null}
                    clubName={tour.club_id ? clubsById[tour.club_id]?.name : null}
                    clubSlug={tour.club_id ? clubsById[tour.club_id]?.slug : null}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* How it works — second section, fills empty atmosphere */}
        <section className="border-t border-border/80 pt-8 space-y-5">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-center">
            {t("home.howItWorksTitle")}
          </h2>
          <ol className="space-y-4 max-w-lg mx-auto">
            <li className="flex gap-3 items-start">
              <QrCode className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">{t("home.howItWorksJoinTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("home.howItWorksJoinBody")}</p>
              </div>
            </li>
            <li className="flex gap-3 items-start">
              <Swords className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">{t("home.howItWorksPlayTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("home.howItWorksPlayBody")}</p>
              </div>
            </li>
            <li className="flex gap-3 items-start">
              <Plus className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">{t("home.howItWorksCreateTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("home.howItWorksCreateBody")}</p>
              </div>
            </li>
          </ol>
        </section>

        {!loadingAuth && !user && (
          <div className="text-center pt-2">
            <p className="text-sm text-muted-foreground mb-3">{t("home.signupPrompt")}</p>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="border-2 hover:border-primary hover:bg-primary/5 bg-transparent"
            >
              <Link href="/auth/signup">{t("home.signUp")}</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
