"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, MapPin, Clock, Navigation, AlertCircle, MapPinOff } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { listNearbyTournaments, type TournamentData } from "@/lib/database/tournament-db"
import { createClient } from "@/lib/supabase/client"

type RadiusOption = 5 | 10 | 25 | 50
type TimeOption = 12 | 24

export default function NearbyPage() {
  const router = useRouter()
  const supabase = createClient()

  const [tournaments, setTournaments] = useState<TournamentData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [locationSource, setLocationSource] = useState<"gps" | "registered" | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [requestingLocation, setRequestingLocation] = useState(true)

  const [radius, setRadius] = useState<RadiusOption>(10)
  const [timeWindow, setTimeWindow] = useState<TimeOption>(12)

  // Get user's registered location and request geolocation
  useEffect(() => {
    async function initLocation() {
      // First, try to get GPS location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lon: position.coords.longitude,
            })
            setLocationSource("gps")
            setRequestingLocation(false)
          },
          async (error) => {
            console.log("[v0] GPS location error, attempting to use registered location")

            // Get user's profile location
            const {
              data: { user },
            } = await supabase.auth.getUser()
            if (user) {
              const { data: profile } = await supabase
                .from("users")
                .select("latitude, longitude, city, country")
                .eq("id", user.id)
                .maybeSingle()

              if (profile?.latitude && profile?.longitude) {
                setUserLocation({
                  lat: profile.latitude,
                  lon: profile.longitude,
                })
                setLocationSource("registered")
                setLocationError(null)
              } else {
                setLocationError("Please set your location in your profile or enable browser location services.")
              }
            } else {
              setLocationError("Please log in to use this feature.")
            }
            setRequestingLocation(false)
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000,
          },
        )
      } else {
        setLocationError("Geolocation is not supported by your browser")
        setRequestingLocation(false)
      }
    }

    initLocation()
  }, [supabase])

  // Fetch nearby tournaments when location or filters change
  useEffect(() => {
    if (!userLocation) return

    async function fetchNearby() {
      setLoading(true)
      setError(null)
      try {
        const results = await listNearbyTournaments(userLocation.lat, userLocation.lon, radius, timeWindow, 10)
        setTournaments(results)
      } catch (err) {
        console.error("[v0] Error fetching nearby tournaments:", err)
        setError("Failed to load tournaments. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    fetchNearby()
  }, [userLocation, radius, timeWindow])

  const formatStartTime = (startTime?: string) => {
    if (!startTime) return "Start time TBD"
    const date = new Date(startTime)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 0) return "Started"
    if (diffMins < 60) return `Starts in ${diffMins} min`
    if (diffMins < 1440) return `Starts in ${Math.floor(diffMins / 60)} hr`
    return date.toLocaleDateString()
  }

  const formatDistance = (tournament: TournamentData) => {
    if (!userLocation || !tournament.latitude || !tournament.longitude) return ""

    const R = 6371
    const dLat = ((tournament.latitude - userLocation.lat) * Math.PI) / 180
    const dLon = ((tournament.longitude - userLocation.lon) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((userLocation.lat * Math.PI) / 180) *
        Math.cos((tournament.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c

    if (distance < 1) return `${Math.round(distance * 1000)} m`
    return `${distance.toFixed(1)} km`
  }

  return (
    <main className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Find Nearby</h1>
            <p className="text-sm text-muted-foreground">
              Tournaments within {radius} km
              {locationSource === "registered" && " (using registered location)"}
              {locationSource === "gps" && " (using GPS)"}
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-3 space-y-3">
            {/* Radius */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Distance</label>
              <div className="flex gap-1.5">
                {([5, 10, 25, 50] as RadiusOption[]).map((r) => (
                  <Button
                    key={r}
                    variant={radius === r ? "default" : "outline"}
                    size="sm"
                    className={`flex-1 ${radius !== r ? "bg-transparent" : ""}`}
                    onClick={() => setRadius(r)}
                  >
                    {r} km
                  </Button>
                ))}
              </div>
            </div>

            {/* Time window */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Starting within</label>
              <div className="flex gap-1.5">
                {([12, 24] as TimeOption[]).map((t) => (
                  <Button
                    key={t}
                    variant={timeWindow === t ? "default" : "outline"}
                    size="sm"
                    className={`flex-1 ${timeWindow !== t ? "bg-transparent" : ""}`}
                    onClick={() => setTimeWindow(t)}
                  >
                    {t} hours
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location status */}
        {requestingLocation && (
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Navigation className="h-5 w-5 text-primary animate-pulse" />
              <div>
                <p className="font-medium">Getting your location...</p>
                <p className="text-sm text-muted-foreground">Please allow location access</p>
              </div>
            </CardContent>
          </Card>
        )}

        {locationError && (
          <Card className="border-destructive">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Location Required</p>
                <p className="text-sm text-muted-foreground">{locationError}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {userLocation && (
          <>
            {loading ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">Searching nearby...</p>
                </CardContent>
              </Card>
            ) : error ? (
              <Card className="border-destructive">
                <CardContent className="p-4">
                  <p className="text-destructive">{error}</p>
                </CardContent>
              </Card>
            ) : tournaments.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center space-y-3">
                  <MapPinOff className="h-10 w-10 mx-auto text-muted-foreground" />
                  <div>
                    <p className="font-medium">No tournaments found</p>
                    <p className="text-sm text-muted-foreground">Try increasing the distance or time window</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {tournaments.map((tournament) => (
                  <Card
                    key={tournament.id}
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => router.push(`/tournament/${tournament.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{tournament.name}</h3>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            {tournament.city && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {tournament.city}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {formatStartTime(tournament.start_time)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-medium text-primary">{formatDistance(tournament)}</div>
                          <div className="text-xs text-muted-foreground capitalize">{tournament.status}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
