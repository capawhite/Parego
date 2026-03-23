"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { loadTournament, loadPlayers, playerNameExistsInTournament, type TournamentData } from "@/lib/database/tournament-db"
import { Loader2, Users, Trophy, MapPin, Check } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { checkVenueProximity } from "@/app/actions/check-in"
import { addGuestSession } from "@/lib/guest-session-history"
import { toast } from "sonner"
import { SIMPLE_LEVELS, resolveRating, type RatingBandValue } from "@/lib/rating-bands"
import { getDeviceId } from "@/lib/device-id"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useI18n } from "@/components/i18n-provider"

export default function JoinTournamentPage() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string
  const { t } = useI18n()

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
        if (profile?.rating_band) {
          const band = profile.rating_band as string
          if (band === "beginner" || band === "intermediate" || band === "advanced") {
            setRatingBand(band as RatingBandValue)
          } else if (band === "around_1500") {
            setRatingBand("intermediate" as RatingBandValue)
          } else if (band === "around_2000" || band === "over_2000") {
            setRatingBand("advanced" as RatingBandValue)
          } else {
            setRatingBand("beginner" as RatingBandValue)
          }
        }
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
          setError(t("join.tournamentNotFound"))
        }
      } catch (err) {
        console.error("[v0] Error loading tournament:", err)
        setError(t("join.failedToLoad"))
      } finally {
        setLoading(false)
      }
    }

    if (code) {
      loadTournamentData()
    }
  }, [code, t])

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
          toast.info(t("join.locationCheckInfo"))
          resolve({ ok: true, checkedInAt: null, presenceSource: null })
          return
        }
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const result = await checkVenueProximity(code, position.coords.latitude, position.coords.longitude)
            if (!result.ok) {
              toast.info(t("join.notAtVenueInfo"))
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
            toast.info(t("join.locationCheckInfo"))
            resolve({ ok: true, checkedInAt: null, presenceSource: null })
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        )
      })
    }

    const handleJoin = async () => {
      if (isRegistered && !playerName.trim()) {
        setError(t("join.errorRegisteredNameRequired"))
        return
      }

      setJoining(true)
      setError("")

      try {
        // Block joining completed tournaments
        if (tournament?.status === "completed") {
          setError(t("join.errorTournamentEnded"))
          setJoining(false)
          return
        }

        // Block late joins when not allowed
        if (tournament?.status === "active") {
          const allowLateJoin = tournament.settings?.allowLateJoin ?? true
          if (!allowLateJoin) {
            setError(t("join.errorLateJoinNotAllowed"))
            setJoining(false)
            return
          }
        }

        setVerifyingLocation(true)
        const proximity = await runProximityCheck()
        setVerifyingLocation(false)

        // Guests must provide name and strength
        if (!isRegistered) {
          if (!guestName.trim()) {
            setError(t("join.errorGuestNameRequired"))
            setJoining(false)
            return
          }
          if (!ratingBand) {
            setError(t("join.errorRatingBandRequired"))
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
            setError(t("join.errorAlreadyJoined"))
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
            t("join.errorNameTaken", {
              name: finalName,
            }),
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
                setError(t("join.errorAlreadyJoined"))
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
        const deviceId = getDeviceId() || null

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
          device_id: deviceId,
        })

        if (insertError) {
          if (insertError.code === "23505") {
            setError("You've already joined this tournament from this device.")
            setAlreadyJoined(true)
            setJoining(false)
            return
          }
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

        // Request browser notification permission so we can alert the player when paired.
        // Only ask if the API exists and permission hasn't been set already.
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
          Notification.requestPermission().catch(() => {
            // Permission denied or not supported — silently ignore.
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
            The tournament code <span className="font-mono">{code}</span> is invalid or the tournament has been
            deleted.
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
    <div className="min-h-svh flex items-center justify-center bg-background p-4 sm:p-6">
      <Card className="w-full max-w-md p-6">
        <div className="text-center mb-6">
          <Trophy className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h1 className="text-2xl font-bold mb-2">Join Tournament</h1>
          <p className="text-lg font-semibold text-foreground">{tournament?.name}</p>
          <div className="flex items-center justify-center gap-2 mt-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{playerCount} players joined</span>
          </div>
          {isRegistered && <div className="mt-2 text-xs text-primary flex items-center justify-center gap-1"><Check className="h-3 w-3" /> Joining as registered user</div>}
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
                  {t("join.guestNameLabelFull")}
                </label>
                <Input
                  id="guestName"
                  type="text"
                  placeholder={t("join.guestNamePlaceholder")}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  disabled={joining}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">{t("join.strengthLabel")}</label>
                <RadioGroup
                  value={ratingBand}
                  onValueChange={(v) => setRatingBand(v as RatingBandValue)}
                  className="flex flex-col gap-2"
                >
                  {SIMPLE_LEVELS.map((level) => (
                    <label
                      key={level.value}
                      className="flex items-center gap-3 rounded-lg border p-3 min-h-[48px] cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5 touch-manipulation"
                    >
                      <RadioGroupItem value={level.value} id={`band-${level.value}`} />
                      <span className="text-sm">{t(level.labelKey)}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
              <div>
                <label htmlFor="ratingPrecise" className="text-sm font-medium mb-2 block">
                  {t("join.ratingPreciseLabel")}
                </label>
                <Input
                  id="ratingPrecise"
                  type="number"
                  placeholder={t("auth.ratingOptionalPlaceholder")}
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
                {t("join.verifyingLocation")}
              </>
            ) : joining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("join.joining")}
              </>
            ) : (
              t("join.joinButton")
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            {t("join.tournamentCode")} <span className="font-mono font-semibold">{code}</span>
          </p>
        </div>
      </Card>
    </div>
  )
}
