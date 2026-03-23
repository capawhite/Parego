"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Zap, MapPin, Hash, User, LogOut, Plus, AlertCircle, Compass, Loader2, RefreshCw } from "lucide-react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import {
  listNearbyTournaments,
  listTournaments,
  getPlayerCounts,
  getPlayerPreviews,
  type TournamentData,
} from "@/lib/database/tournament-db"
import { LandingTournamentCard } from "@/components/landing-tournament-card"
import { toast } from "sonner"
import { useI18n } from "@/components/i18n-provider"

const NEARBY_RADIUS_KM = 15
const NEARBY_HOURS = 24
const FALLBACK_LIST_LIMIT = 8

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
  const [loadingNearby, setLoadingNearby] = useState(false)
  const [loadingFallback, setLoadingFallback] = useState(false)
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({})
  const [playerPreviews, setPlayerPreviews] = useState<Record<string, string[]>>({})
  const [refreshing, setRefreshing] = useState(false)

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
    listTournaments(FALLBACK_LIST_LIMIT)
      .then((data) => {
        if (!cancelled) setFallbackTournaments(data.filter((t) => t.status !== "completed"))
      })
      .finally(() => {
        if (!cancelled) setLoadingFallback(false)
      })
    return () => {
      cancelled = true
    }
  }, [locationStatus])

  // Refetch tournaments (used by periodic refresh, manual button, and tab focus)
  const refreshTournaments = useCallback(async () => {
    setRefreshing(true)
    try {
      if (locationStatus === "granted" && userLocation) {
        const data = await listNearbyTournaments(userLocation.lat, userLocation.lon, NEARBY_RADIUS_KM, NEARBY_HOURS, 10)
        setNearbyTournaments(data)
      } else if (locationStatus === "denied" || locationStatus === "unsupported") {
        const data = await listTournaments(FALLBACK_LIST_LIMIT)
        setFallbackTournaments(data.filter((t) => t.status !== "completed"))
      }
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

  // Load player counts and previews when tournament list changes
  const displayedTournaments = showNearby ? nearbyTournaments : fallbackTournaments
  const previewTournamentIds = useMemo(
    () => displayedTournaments.map((t) => t.id),
    [displayedTournaments],
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
    <main className="min-h-svh">
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between gap-3 p-4">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <Zap className="h-8 w-8 shrink-0 text-primary" strokeWidth={2.5} fill="currentColor" />
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent truncate">
            Parego
          </span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12 space-y-8">
        {/* Hero copy */}
        <div className="text-center space-y-1 pt-2 px-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t("home.heroTagline")}</h1>
          <p className="text-muted-foreground text-sm font-medium">{t("home.heroTitle")}</p>
          <p className="text-muted-foreground text-xs">{t("home.heroSubtitle")}</p>
          {!loadingAuth && !user && (
            <p className="text-primary/90 text-sm font-medium pt-1">{t("home.registerToCreate")}</p>
          )}
        </div>

        {/* Top CTAs: Create tournament + Join with code */}
        <div className="flex flex-col sm:flex-row gap-3 max-w-2xl">
          {user && (
            <Button variant="outline" className="sm:flex-1 border-2 hover:border-primary hover:bg-primary/5 font-semibold h-12" asChild>
              <Link href="/create">
                <Plus className="h-4 w-4 mr-2 shrink-0" />
                {t("home.ctaCreate")}
              </Link>
            </Button>
          )}
          <div className="sm:flex-1 flex flex-col gap-0 rounded-md border-2 border-input bg-background hover:border-primary hover:bg-primary/5 transition-colors overflow-hidden">
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
                  <Button variant="outline" className="flex-1" onClick={() => { setShowCodeInput(false); setJoinCode("") }}>
                    {t("common.cancel")}
                  </Button>
                  <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleJoinWithCode} disabled={!joinCode.trim()}>
                    {t("home.joinButton")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full h-12 rounded-md border-0 border-transparent bg-transparent hover:bg-primary/5 font-semibold justify-start px-4 sm:px-6 shadow-none"
                onClick={() => setShowCodeInput(true)}
              >
                <Hash className="h-4 w-4 mr-2 shrink-0" strokeWidth={2.5} />
                <span className="truncate">{t("home.ctaJoin")}</span>
                <span className="text-muted-foreground font-normal text-sm ml-1.5 hidden sm:inline truncate">— {t("home.enterCodeOrQr")}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Location pending */}
        {locationStatus === "pending" && (
          <Card className="border-2 border-primary/20">
            <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
              <Compass className="h-10 w-10 text-primary animate-pulse" />
              <div>
                <p className="font-medium">Getting your location...</p>
                <p className="text-sm text-muted-foreground">We use it only to show nearby tournaments. Allow access to see what’s happening around you.</p>
              </div>
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {/* Nearby list (when location granted) */}
        {showNearby && (
          <>
            {loadingNearby ? (
              <Card>
                <CardContent className="p-8 flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">{t("home.searchingNearby")}</p>
                </CardContent>
              </Card>
            ) : hasNearbyList ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("home.withinKmHours", { km: NEARBY_RADIUS_KM, hours: NEARBY_HOURS })}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href="/nearby"
                      className="text-sm text-primary hover:underline"
                    >
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {nearbyTournaments.map((t) => (
                    <LandingTournamentCard
                      key={t.id}
                      tournament={t}
                      userCoords={userLocation}
                      showDistance={true}
                      playerCount={playerCounts[t.id] ?? 0}
                      playerNames={playerPreviews[t.id] ?? []}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center space-y-3">
                  <MapPin className="h-10 w-10 mx-auto text-muted-foreground" />
                  <div>
                    <p className="font-medium">{t("home.noTournamentsNearby")}</p>
                    <p className="text-sm text-muted-foreground">{t("home.noTournamentsHint")}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/nearby">{t("home.adjustDistanceTime")}</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Location denied / unsupported: fallback */}
        {showFallback && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">{t("home.locationOff")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("home.locationOffHint")}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/nearby">{t("home.tryFindNearby")}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fallback list: recent tournaments when no location */}
        {hasFallbackList && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">{t("home.recentTournaments")}</h2>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {fallbackTournaments.map((t) => (
                <LandingTournamentCard
                  key={t.id}
                  tournament={t}
                  userCoords={null}
                  showDistance={false}
                  playerCount={playerCounts[t.id] ?? 0}
                  playerNames={playerPreviews[t.id] ?? []}
                />
              ))}
            </div>
          </div>
        )}

        {/* Soft signup prompt when not logged in */}
        {!loadingAuth && !user && (
          <div className="text-center pt-4 border-t max-w-md mx-auto">
            <p className="text-sm text-muted-foreground mb-3">{t("home.signupPrompt")}</p>
            <Button variant="outline" size="sm" asChild className="border-2 hover:border-primary hover:bg-primary/5 bg-transparent">
              <Link href="/auth/signup">{t("home.signUp")}</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
