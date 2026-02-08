"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Zap, MapPin, Hash, User, LogOut, Plus, AlertCircle, Compass, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import {
  listNearbyTournaments,
  listTournaments,
  getInterestCounts,
  getPlayerCounts,
  getPlayerPreviews,
  getUserInterests,
  type TournamentData,
} from "@/lib/database/tournament-db"
import { LandingTournamentCard } from "@/components/landing-tournament-card"
import { toggleInterest } from "@/app/actions/express-interest"
import { toast } from "sonner"

const NEARBY_RADIUS_KM = 15
const NEARBY_HOURS = 24
const FALLBACK_LIST_LIMIT = 8

export default function Home() {
  const router = useRouter()
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
  const [interestCounts, setInterestCounts] = useState<Record<string, number>>({})
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({})
  const [playerPreviews, setPlayerPreviews] = useState<Record<string, string[]>>({})
  const [userInterests, setUserInterests] = useState<Set<string>>(new Set())
  const [togglingId, setTogglingId] = useState<string | null>(null)

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

  const showNearby = locationStatus === "granted" && userLocation
  const showFallback = (locationStatus === "denied" || locationStatus === "unsupported") && !showNearby
  const hasNearbyList = showNearby && nearbyTournaments.length > 0
  const hasFallbackList = showFallback && fallbackTournaments.length > 0

  // Load interest counts and user's interests when tournament list or user changes
  const displayedTournaments = showNearby ? nearbyTournaments : fallbackTournaments
  const tournamentIds = displayedTournaments.map((t) => t.id)
  useEffect(() => {
    if (tournamentIds.length === 0) return
    let cancelled = false
    Promise.all([
      getInterestCounts(tournamentIds),
      getPlayerCounts(tournamentIds),
      getPlayerPreviews(tournamentIds, 5),
      user ? getUserInterests(user.id, tournamentIds) : Promise.resolve(new Set<string>()),
    ]).then(([interestCountsData, counts, previews, interests]) => {
      if (!cancelled) {
        setInterestCounts(interestCountsData)
        setPlayerCounts(counts)
        setPlayerPreviews(previews)
        setUserInterests(interests)
      }
    })
    return () => {
      cancelled = true
    }
  }, [tournamentIds.join(","), user?.id])

  const handleToggleInterest = async (tournamentId: string) => {
    setTogglingId(tournamentId)
    try {
      const result = await toggleInterest(tournamentId)
      if (!result.ok) {
        toast.error(result.error ?? "Could not update interest")
        return
      }
      setInterestCounts((prev) => ({ ...prev, [tournamentId]: result.count }))
      setUserInterests((prev) => {
        const next = new Set(prev)
        if (result.interested) next.add(tournamentId)
        else next.delete(tournamentId)
        return next
      })
    } finally {
      setTogglingId(null)
    }
  }

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
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-20 right-10 w-96 h-96 bg-accent-foreground/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
      </div>

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
            <span className="text-sm text-muted-foreground">Loading...</span>
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
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="min-h-10" asChild>
                <Link href="/auth/login">Login</Link>
              </Button>
              <Button variant="default" size="sm" className="min-h-10 bg-primary hover:bg-primary/90" asChild>
                <Link href="/auth/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pb-12 space-y-8">
        {/* Hero copy */}
        <div className="text-center space-y-1 pt-2 px-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Tournaments near you</h1>
          <p className="text-muted-foreground text-sm">Find one, view it, or join—no signup required to browse.</p>
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
                  <p className="text-sm text-muted-foreground">Searching nearby...</p>
                </CardContent>
              </Card>
            ) : hasNearbyList ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  Within {NEARBY_RADIUS_KM} km · next {NEARBY_HOURS} hours
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {nearbyTournaments.map((t) => (
                    <LandingTournamentCard
                      key={t.id}
                      tournament={t}
                      userCoords={userLocation}
                      showDistance={true}
                      interestCount={interestCounts[t.id] ?? 0}
                      playerCount={playerCounts[t.id] ?? 0}
                      playerNames={playerPreviews[t.id] ?? []}
                      userInterested={userInterests.has(t.id)}
                      onToggleInterest={user ? handleToggleInterest : undefined}
                      togglingInterest={togglingId === t.id}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center space-y-3">
                  <MapPin className="h-10 w-10 mx-auto text-muted-foreground" />
                  <div>
                    <p className="font-medium">No tournaments nearby right now</p>
                    <p className="text-sm text-muted-foreground">Try a different radius or join with a code below.</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/nearby">Adjust distance & time</Link>
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
                  <p className="font-medium">Location is off</p>
                  <p className="text-sm text-muted-foreground">
                    We need location to show tournaments near you. You can still browse recent tournaments or join with a code. To actually join and play, you’ll need to be at the venue.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/nearby">Try “Find nearby”</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fallback list: recent tournaments when no location */}
        {hasFallbackList && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Recent tournaments</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {fallbackTournaments.map((t) => (
                <LandingTournamentCard
                  key={t.id}
                  tournament={t}
                  userCoords={null}
                  showDistance={false}
                  interestCount={interestCounts[t.id] ?? 0}
                  playerCount={playerCounts[t.id] ?? 0}
                  playerNames={playerPreviews[t.id] ?? []}
                  userInterested={userInterests.has(t.id)}
                  onToggleInterest={user ? handleToggleInterest : undefined}
                  togglingInterest={togglingId === t.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Join with code & Find nearby */}
        <div className="space-y-3 pt-2 max-w-md">
          <h2 className="text-sm font-medium text-muted-foreground">Or</h2>
          <Card className="overflow-hidden border-2 hover:border-primary/50 transition-all duration-300">
            <CardContent className="p-0">
              {showCodeInput ? (
                <div className="p-4 space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter tournament code"
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
                      Cancel
                    </Button>
                    <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleJoinWithCode} disabled={!joinCode.trim()}>
                      Join
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full h-16 justify-start px-6 hover:bg-primary/5 rounded-none group"
                  onClick={() => setShowCodeInput(true)}
                >
                  <Hash className="h-6 w-6 mr-4 text-primary group-hover:scale-110 transition-transform" strokeWidth={2.5} />
                  <div className="text-left">
                    <div className="font-bold">Join with code</div>
                    <div className="text-sm text-muted-foreground font-normal">Enter code or scan QR</div>
                  </div>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-2 hover:border-primary/50 transition-all duration-300">
            <CardContent className="p-0">
              <Button
                variant="ghost"
                className="w-full h-16 justify-start px-6 hover:bg-primary/5 rounded-none group"
                onClick={() => router.push("/nearby")}
                asChild
              >
                <Link href="/nearby">
                  <MapPin className="h-6 w-6 mr-4 text-primary group-hover:scale-110 transition-transform" strokeWidth={2.5} />
                  <div className="text-left">
                    <div className="font-bold">Find nearby</div>
                    <div className="text-sm text-muted-foreground font-normal">Distance & time filters</div>
                  </div>
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Create tournament (logged in) */}
        {user && (
          <div className="pt-4 border-t max-w-md">
            <Button variant="outline" className="w-full border-2 hover:border-primary hover:bg-primary/5 font-semibold" asChild>
              <Link href="/create">
                <Plus className="h-4 w-4 mr-2" />
                Create tournament
              </Link>
            </Button>
          </div>
        )}

        {/* Soft signup prompt when not logged in */}
        {!loadingAuth && !user && (
          <div className="text-center pt-4 border-t max-w-md mx-auto">
            <p className="text-sm text-muted-foreground mb-3">Create and run tournaments, track your progress</p>
            <Button variant="outline" size="sm" asChild className="border-2 hover:border-primary hover:bg-primary/5 bg-transparent">
              <Link href="/auth/signup">Sign up</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
