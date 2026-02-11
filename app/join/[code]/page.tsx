"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { loadTournament, loadPlayers, playerNameExistsInTournament, type TournamentData } from "@/lib/database/tournament-db"
import { Loader2, Users, Trophy, MapPin } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { checkVenueProximity } from "@/app/actions/check-in"
import { addGuestSession } from "@/lib/guest-session-history"
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
  const [guestName, setGuestName] = useState("")
  const [alreadyJoined, setAlreadyJoined] = useState(false)

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

  // Prevent duplicate joins: check DB for registered users, localStorage for guests
  useEffect(() => {
    if (loading || !tournament || !code) return

    async function checkAlreadyJoined() {
      // Guest: check localStorage (same browser session)
      if (!isRegistered) {
        try {
          const stored = localStorage.getItem("tournamentPlayer")
          if (stored) {
            const parsed = JSON.parse(stored)
            if (parsed?.tournamentId === code) {
              setAlreadyJoined(true)
            }
          }
        } catch {
          // ignore parse errors
        }
        return
      }

      // Registered: check if user is already in this tournament
      if (userId) {
        const players = await loadPlayers(code)
        const found = players.some((p) => p.userId === userId)
        if (found) setAlreadyJoined(true)
      }
    }

    checkAlreadyJoined()
  }, [loading, tournament, code, isRegistered, userId])

  const runProximityCheck = (): Promise<{ ok: boolean; checkedInAt: string | null; presenceSource: "gps" | null }> => {
      return new Promise((resolve) => {
        const hasVenue = tournament?.latitude != null && tournament?.longitude != null
        if (!hasVenue) {
          resolve({ ok: true, checkedInAt: null, presenceSource: null })
          return
        }
        if (!navigator.geolocation) {
          toast.info("Location unavailable. You can still join; the organizer will confirm you at the venue.")
          resolve({ ok: true, checkedInAt: null, presenceSource: null })
          return
        }
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const result = await checkVenueProximity(code, position.coords.latitude, position.coords.longitude)
            if (!result.ok) {
              toast.info("You're not at the venue yet. You can still join; the organizer will confirm you when you arrive.")
              resolve({ ok: true, checkedInAt: null, presenceSource: null })
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
            toast.info("Location unavailable. You can still join; the organizer will confirm you at the venue.")
            resolve({ ok: true, checkedInAt: null, presenceSource: null })
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        )
      })
    }

    const handleJoin = async () => {
      if (isRegistered && !playerName.trim()) {
        setError("Please enter your name")
        return
      }

      setJoining(true)
      setError("")

      try {
        setVerifyingLocation(true)
        const proximity = await runProximityCheck()
        setVerifyingLocation(false)

        // Guests must provide name and strength
        if (!isRegistered) {
          if (!guestName.trim()) {
            setError("Please enter your name for the pairings board.")
            setJoining(false)
            return
          }
          if (!ratingBand) {
            setError("Please choose how you'd describe your strength.")
            setJoining(false)
            return
          }
        }

        // Defensive: registered users - verify not already in tournament (e.g. joined from another tab)
        if (isRegistered && userId) {
          const supabaseClient = createClient()
          const { data: existingByUser } = await supabaseClient
            .from("players")
            .select("id")
            .eq("tournament_id", code)
            .eq("user_id", userId)
            .maybeSingle()
          if (existingByUser) {
            setError("You have already joined this tournament.")
            setAlreadyJoined(true)
            setJoining(false)
            return
          }
        }

        const preciseNum = ratingPrecise.trim() ? parseInt(ratingPrecise.trim(), 10) : null
        const playerRating = resolveRating(
          preciseNum != null && !isNaN(preciseNum) ? preciseNum : null,
          ratingBand ? (ratingBand as RatingBandValue) : undefined,
        )

        let finalName = isRegistered ? playerName.trim() : guestName.trim()
        const isGuest = !isRegistered

        const nameTaken = await playerNameExistsInTournament(code, finalName)
        if (nameTaken) {
          setError(
            `${finalName} already exists in this tournament. Try a different name, e.g. ${finalName} R. or ${finalName} (Madrid).`,
          )
          setJoining(false)
          return
        }

        if (!isRegistered) {
          // Defensive: guest already joined in this session (localStorage)
          try {
            const stored = localStorage.getItem("tournamentPlayer")
            if (stored) {
              const parsed = JSON.parse(stored)
              if (parsed?.tournamentId === code) {
                setError("You have already joined this tournament.")
                setAlreadyJoined(true)
                setJoining(false)
                return
              }
            }
          } catch {
            // ignore
          }
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
          }),
        )

        if (isGuest) {
          addGuestSession({
            tournamentId: code,
            playerId: newPlayerId,
            displayName: finalName,
          })
        }

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

  if (alreadyJoined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-6 text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Trophy className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Already Joined</h1>
          <p className="text-muted-foreground mb-4">
            You have already joined <span className="font-semibold">{tournament?.name}</span>
          </p>
          <Button onClick={() => router.push(`/tournament/${code}`)} className="w-full" size="lg">
            Go to Tournament
          </Button>
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-6">
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
          {isRegistered && (
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
                disabled={joining || !!playerName}
                className="w-full"
              />
            </div>
          )}

          {!isRegistered && (
            <>
              <div>
                <label htmlFor="guestName" className="text-sm font-medium mb-2 block">
                  Your name (for pairings and announcements)
                </label>
                <Input
                  id="guestName"
                  type="text"
                  placeholder="e.g. Alex or nickname"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  disabled={joining}
                  className="w-full"
                />
              </div>
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
                      className="flex items-center gap-3 rounded-lg border p-3 min-h-[48px] cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5 touch-manipulation"
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
            disabled={
              joining ||
              (isRegistered && !playerName.trim()) ||
              (!isRegistered && (!guestName.trim() || !ratingBand)) ||
              verifyingLocation
            }
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
