"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { loadTournament, loadPlayers, type TournamentData } from "@/lib/database/tournament-db"
import { Loader2, Users, Trophy, MapPin } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { generateGuestUsername } from "@/lib/guest-names"
import { checkVenueProximity } from "@/app/actions/check-in"
import { toast } from "sonner"
import { RATING_BANDS, resolveRating, type RatingBandValue } from "@/lib/rating-bands"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export default function JoinTournamentPage() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string

  const [tournament, setTournament] = useState<TournamentData | null>(null)
  const [playerCount, setPlayerCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [playerName, setPlayerName] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [verifyingLocation, setVerifyingLocation] = useState(false)
  const [ratingBand, setRatingBand] = useState<RatingBandValue | "">("")
  const [ratingPrecise, setRatingPrecise] = useState("")

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setIsRegistered(true)
        setUserId(user.id)

        // Auto-fill name and rating from profile
        const { data: profile } = await supabase
          .from("users")
          .select("name, rating_band, rating")
          .eq("id", user.id)
          .maybeSingle()

        if (profile?.name) setPlayerName(profile.name)
        if (profile?.rating_band) setRatingBand(profile.rating_band as RatingBandValue)
        if (profile?.rating != null) setRatingPrecise(String(profile.rating))
      }
    }

    checkAuth()
  }, [])

  useEffect(() => {
    async function loadTournamentData() {
      try {
        const data = await loadTournament(code)
        if (data) {
          setTournament(data)
          const players = await loadPlayers(code)
          setPlayerCount(players.length)
        } else {
          setError("Tournament not found")
        }
      } catch (err) {
        console.error("[v0] Error loading tournament:", err)
        setError("Failed to load tournament")
      } finally {
        setLoading(false)
      }
    }

    if (code) {
      loadTournamentData()
    }
  }, [code])

  const runProximityCheck = (): Promise<{ ok: boolean; checkedInAt: string | null; presenceSource: "gps" | null }> => {
      return new Promise((resolve) => {
        const hasVenue = tournament?.latitude != null && tournament?.longitude != null
        if (!hasVenue) {
          resolve({ ok: true, checkedInAt: null, presenceSource: null })
          return
        }
        if (!navigator.geolocation) {
          toast.error("Location is required to join at the venue.")
          resolve({ ok: false, checkedInAt: null, presenceSource: null })
          return
        }
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const result = await checkVenueProximity(code, position.coords.latitude, position.coords.longitude)
            if (!result.ok) {
              toast.error(result.error)
              resolve({ ok: false, checkedInAt: null, presenceSource: null })
              return
            }
            resolve({
              ok: true,
              checkedInAt:
                tournament?.latitude != null && tournament?.longitude != null ? new Date().toISOString() : null,
              presenceSource:
                tournament?.latitude != null && tournament?.longitude != null ? "gps" : null,
            })
          },
          () => {
            toast.error("Could not get your location. Allow location access to join at the venue.")
            resolve({ ok: false, checkedInAt: null, presenceSource: null })
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        )
      })
    }

    const handleJoin = async () => {
      if (!playerName.trim()) {
        setError("Please enter your name")
        return
      }

      setJoining(true)
      setError("")

      try {
        setVerifyingLocation(true)
        let proximity = await runProximityCheck()
        if (!proximity.ok) {
          toast.info("Retrying in 2 seconds...")
          await new Promise((r) => setTimeout(r, 2000))
          proximity = await runProximityCheck()
        }
        setVerifyingLocation(false)
        if (!proximity.ok) {
          setError("You must be at the venue to join. Enable location and get closer, or ask the organizer to add you.")
          setJoining(false)
          return
        }

        // Guests must choose strength; registered users use profile rating
        if (!isRegistered && !ratingBand) {
          setError("Please choose how you'd describe your strength.")
          setJoining(false)
          return
        }

        const preciseNum = ratingPrecise.trim() ? parseInt(ratingPrecise.trim(), 10) : null
        const playerRating = resolveRating(
          preciseNum != null && !isNaN(preciseNum) ? preciseNum : null,
          ratingBand ? (ratingBand as RatingBandValue) : undefined,
        )

        let finalName = playerName.trim()
        let guestUsername = null
        const isGuest = !isRegistered

        if (!isRegistered) {
          const supabase = createClient()

          // Fetch existing player names to avoid collisions
          const { data: existingPlayers } = await supabase.from("players").select("name").eq("tournament_id", code)

          const existingNames = existingPlayers?.map((p) => p.name) || []
          guestUsername = generateGuestUsername(existingNames)
          finalName = guestUsername
        }

        const supabase = createClient()
        const newPlayerId = globalThis.crypto.randomUUID()

        const { error: insertError } = await supabase.from("players").insert({
          id: newPlayerId,
          tournament_id: code,
          name: finalName,
          user_id: isRegistered ? userId : null,
          is_guest: isGuest,
          points: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          games_played: 0,
          white_count: 0,
          black_count: 0,
          current_streak: 0,
          on_streak: false,
          paused: false,
          game_history: [],
          opponents: [],
          results: [],
          colors: [],
          points_earned: [],
          table_numbers: [],
          checked_in_at: proximity.checkedInAt,
          presence_source: proximity.presenceSource,
          rating: playerRating,
        })

        if (insertError) {
          console.error("[v0] Error joining tournament:", insertError)
          setError("Failed to join tournament. Please try again.")
          return
        }

        setSuccess(true)
        localStorage.setItem(
          "tournamentPlayer",
          JSON.stringify({
            tournamentId: code,
            playerName: finalName,
            playerId: newPlayerId,
            role: "player",
            isGuest: isGuest,
            guestUsername: guestUsername,
          }),
        )

        setTimeout(() => {
          router.push(`/tournament/${code}`)
        }, 2000)
      } catch (err) {
        console.error("[v0] Error joining tournament:", err)
        setError("Failed to join tournament")
      } finally {
        setJoining(false)
        setVerifyingLocation(false)
      }
    }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error && !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-6 text-center">
          <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Tournament Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The tournament code "{code}" is invalid or the tournament has been deleted.
          </p>
          <Button onClick={() => router.push("/")}>Go to Homepage</Button>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-6 text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Trophy className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Successfully Joined!</h1>
          <p className="text-muted-foreground mb-4">
            Welcome to <span className="font-semibold">{tournament?.name}</span>
          </p>
          <p className="text-sm text-muted-foreground">Redirecting to tournament...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-6">
        <div className="text-center mb-6">
          <Trophy className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h1 className="text-2xl font-bold mb-2">Join Tournament</h1>
          <p className="text-lg font-semibold text-foreground">{tournament?.name}</p>
          <div className="flex items-center justify-center gap-2 mt-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{playerCount} players joined</span>
          </div>
          {isRegistered && <div className="mt-2 text-xs text-primary">✓ Joining as registered user</div>}
          {!isRegistered && (
            <div className="mt-2 text-xs text-muted-foreground">
              Joining as guest •{" "}
              <Link href="/auth/signup" className="underline">
                Register
              </Link>{" "}
              to track your progress
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="playerName" className="text-sm font-medium mb-2 block">
              Your Name
            </label>
            <Input
              id="playerName"
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJoin()
              }}
              disabled={joining || (isRegistered && !!playerName)}
              className="w-full"
            />
          </div>

          {!isRegistered && (
            <>
              <div>
                <label className="text-sm font-medium mb-2 block">How would you describe your strength?</label>
                <RadioGroup
                  value={ratingBand}
                  onValueChange={(v) => setRatingBand(v as RatingBandValue)}
                  className="flex flex-col gap-2"
                >
                  {RATING_BANDS.map((band) => (
                    <label
                      key={band.value}
                      className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <RadioGroupItem value={band.value} id={`band-${band.value}`} />
                      <span className="text-sm">{band.label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
              <div>
                <label htmlFor="ratingPrecise" className="text-sm font-medium mb-2 block">
                  Optional: exact rating (number)
                </label>
                <Input
                  id="ratingPrecise"
                  type="number"
                  placeholder="e.g. 1847"
                  min={100}
                  max={3000}
                  value={ratingPrecise}
                  onChange={(e) => setRatingPrecise(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  disabled={joining}
                  className="w-full"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            onClick={handleJoin}
            disabled={joining || !playerName.trim() || (!isRegistered && !ratingBand) || verifyingLocation}
            className="w-full"
            size="lg"
          >
            {verifyingLocation ? (
              <>
                <MapPin className="mr-2 h-4 w-4" />
                Verifying location...
              </>
            ) : joining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              "Join Tournament"
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Tournament Code: <span className="font-mono font-semibold">{code}</span>
          </p>
        </div>
      </Card>
    </div>
  )
}
