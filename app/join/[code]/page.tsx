"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { loadTournament, loadPlayers, type TournamentData } from "@/lib/database/tournament-db"
import { Loader2, Users, Trophy } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { generateGuestUsername } from "@/lib/guest-names"

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

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setIsRegistered(true)
        setUserId(user.id)

        // Auto-fill name from profile
        const { data: profile } = await supabase.from("users").select("name").eq("id", user.id).maybeSingle()

        if (profile?.name) {
          setPlayerName(profile.name)
        }
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

  const handleJoin = async () => {
    if (!playerName.trim()) {
      setError("Please enter your name")
      return
    }

    setJoining(true)
    setError("")

    try {
      let finalName = playerName.trim()
      let guestUsername = null
      const isGuest = !isRegistered

      if (!isRegistered) {
        const supabase = createClient()

        // Fetch existing player names to avoid collisions
        const { data: existingPlayers } = await supabase.from("players").select("name").eq("tournament_id", code)

        const existingNames = existingPlayers?.map((p) => p.name) || []
        guestUsername = generateGuestUsername(existingNames)
        console.log("[v0] Generated guest username:", guestUsername)
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={handleJoin} disabled={joining || !playerName.trim()} className="w-full" size="lg">
            {joining ? (
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
