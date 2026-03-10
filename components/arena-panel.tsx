"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card" // Added CardDescription
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CurrentRound } from "./current-round"
import { Leaderboard } from "./leaderboard"
import { TournamentPodium } from "./tournament-podium"
import { TournamentSettingsPanel, type TournamentSettings } from "./tournament-settings" // Import TournamentSettings
import { Badge } from "@/components/ui/badge"
import { PlayersList } from "@/components/players-list"
import type { ArenaState, Player, Match, MatchResult } from "@/lib/types" // Added Match import and MatchResult
import { getPairingAlgorithm } from "@/lib/pairing"
import {
  Maximize2,
  X,
  QrCode,
  Trophy,
  Users,
  Swords,
  Award,
  SettingsIcon,
  Clock,
  Home,
  UserPlus,
  Check,
  Heart,
  Loader2,
  MapPin,
  AlertCircle,
} from "lucide-react" // Added SettingsIcon, Home, Grid3x3, ClipboardList, AlertTriangle, UserPlus, Check
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DEFAULT_SETTINGS } from "@/lib/types"
import {
  saveTournament,
  loadTournament,
  loadPlayers,
  savePlayers,
  saveMatches,
  loadMatches,
  playerNameExistsInTournament,
  getInterestCount,
  getInterestedUsers,
  getUserInterested,
  getAvatarUrls,
  type InterestedUser,
} from "@/lib/database/tournament-db"
import { generateQRCode } from "@/lib/qr-utils" // Fixed import to use correct path for generateQRCode
import { TournamentSimulatorPanel } from "@/components/tournament-simulator-panel"
import { useRouter } from "next/navigation"
import { AlgorithmComparisonPanel } from "./algorithm-comparison-panel"
import { UserSearchAutocomplete } from "@/components/user-search-autocomplete" // Import UserSearchAutocomplete
import { createClient } from "@/lib/supabase/client" // Import createClient for Supabase
import Link from "next/link" // Import Link for navigation
import { Label } from "@/components/ui/label" // Import Label for forms
import { generateGuestUsername } from "@/lib/guest-names" // Import memorable guest name generator
import {
  addGuestSession,
  getGuestSessionHistory,
  getConversionPromptDismissed,
  type GuestSessionEntry,
} from "@/lib/guest-session-history"
import { ConversionPrompt, type ConversionTrigger } from "@/components/conversion-prompt"
import { cn } from "@/lib/utils"
import { toggleInterest } from "@/app/actions/express-interest"
import { verifyAndCheckIn, markPresentOverride, checkVenueProximity } from "@/app/actions/check-in"
import { renamePlayer } from "@/app/actions/rename-player"
import { resolveRating } from "@/lib/rating-bands"
import { toast } from "sonner"
import { useRealtime } from "@/hooks/tournament/use-realtime"
import { getDeviceId } from "@/lib/device-id"

const TOURNAMENT_DURATION = 60 * 60 * 1000 // 1 hour in milliseconds

// Debug logging - set to false in production
const DEBUG = process.env.NODE_ENV === "development"

interface ArenaPanelProps {
  tournamentId: string
  tournamentName: string
  isPlayerView?: boolean
}

interface ArenaSessionData {
  tournamentId: string
  playerName?: string
  playerId?: string
  role?: "organizer" | "player"
}

function generateTournamentId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

/** Merge paired and completed matches for saving; completed version wins on duplicate ids */
function mergeMatchesForSave(paired: Match[], allTime: Match[]): Match[] {
  const map = new Map<string, Match>()
  paired.forEach((m) => map.set(m.id, m))
  allTime.forEach((m) => map.set(m.id, m))
  return Array.from(map.values())
}

export function ArenaPanel({ tournamentId: initialTournamentId, tournamentName, isPlayerView }: ArenaPanelProps) {
  const router = useRouter()
  const [arenaState, setArenaState] = useState<ArenaState>({
    players: [],
    rounds: [],
    currentRound: null,
    pairedMatches: [],
    tournamentStartTime: null,
    tournamentDuration: TOURNAMENT_DURATION,
    isActive: false,
    allTimeMatches: [],
    tableCount: 0,
    settings: DEFAULT_SETTINGS,
    status: "setup", // Added status field
  })
  const [tournamentId, setTournamentId] = useState<string | null>(initialTournamentId || null)
  const [displayName, setDisplayName] = useState(tournamentName || "Arena Tournament")
  const [playerNameInput, setPlayerNameInput] = useState("") // Renamed to playerNameInput
  const [tableCountInput, setTableCountInput] = useState("")
  const [tournamentDurationInput, setTournamentDurationInput] = useState("60") // Default 60 minutes
  const [timeRemaining, setTimeRemaining] = useState(TOURNAMENT_DURATION)
  const [completionRatio, setCompletionRatio] = useState(0)
  const [showPodium, setShowPodium] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isFullScreenPairings, setIsFullScreenPairings] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("players")
  const [hasNewPairing, setHasNewPairing] = useState(false)
  // const [effectivePlayerView, setIsPlayerView] = useState(false) // Moved to props
  const [playerSession, setPlayerSession] = useState<ArenaSessionData | null>(null)
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false)
  const [playerSubmissions, setPlayerSubmissions] = useState<
    Record<string, { result: "player1-win" | "draw" | "player2-win"; confirmed: boolean }>
  >({})

  const [showEndDialog, setShowEndDialog] = useState(false)
  const [waitingForFinalResults, setWaitingForFinalResults] = useState(false)
  const [showSimulator, setShowSimulator] = useState(false)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [organizerId, setOrganizerId] = useState<string | null>(null)
  const [organizerName, setOrganizerName] = useState<string | null>(null)
  const [tournamentMetadata, setTournamentMetadata] = useState<{
    city?: string
    country?: string
    latitude?: number
    longitude?: number
    visibility?: "public" | "private"
  } | null>(null)
  const [currentPlayerInTournament, setCurrentPlayerInTournament] = useState<Player | null>(null)
  const [userName, setUserName] = useState<string>("") // For logged-in user joining
  const [userRating, setUserRating] = useState<number | null>(null)
  const [userRatingBand, setUserRatingBand] = useState<string | null>(null) // rating_band from profile
  const [userCountry, setUserCountry] = useState<string | null>(null)

  const [interestCount, setInterestCount] = useState(0)
  const [interestedUsers, setInterestedUsers] = useState<InterestedUser[]>([])
  const [userInterested, setUserInterested] = useState(false)
  const [togglingInterest, setTogglingInterest] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [markingPresentPlayerId, setMarkingPresentPlayerId] = useState<string | null>(null)
  const [renamingPlayerId, setRenamingPlayerId] = useState<string | null>(null)
  const [joiningSelf, setJoiningSelf] = useState(false)
  const [pastGuestSessions, setPastGuestSessions] = useState<GuestSessionEntry[]>([])
  const [showConversionPrompt, setShowConversionPrompt] = useState<ConversionTrigger | null>(null)

  const isOrganizer = currentUserId !== null && currentUserId === organizerId

  const isCurrentUserInTournament = currentUserId
    ? arenaState.players.some((p) => p.userId === currentUserId && !p.hasLeft)
    : false

  // Determine user role for permission system
  type UserRole = "organizer" | "registered-player" | "guest-player" | "visitor"
  const userRole: UserRole = isOrganizer
    ? "organizer"
    : isCurrentUserInTournament
      ? "registered-player"
      : playerSession?.playerId
        ? "guest-player"
        : "visitor"

  // Permission system based on user role
  const permissions = {
    canStartTournament: userRole === "organizer",
    canEndTournament: userRole === "organizer",
    canRecordAnyResult: userRole === "organizer",
    canSubmitOwnResult: ["organizer", "registered-player", "guest-player"].includes(userRole),
    canEditSettings: userRole === "organizer",
    canAddPlayers: userRole === "organizer",
    canRemoveAnyPlayer: userRole === "organizer",
    canViewAllMatches: ["organizer", "visitor"].includes(userRole),
    canAccessQR: userRole === "organizer",
    canAccessSettings: userRole === "organizer",
  }

  // Derive player view from session when not passed as prop (parent page doesn't pass it)
  // Players who joined via /join link see simplified UI: no Players tab, no result override, etc.
  // Organizers always see full UI even if they also joined as a player
  const effectivePlayerView =
    !isOrganizer && (isPlayerView ?? (playerSession?.role === "player" && !!playerSession?.playerId))

  // Fires when the local player is paired into a new match (via Realtime)
  const handleNewPairing = useCallback(
    (match: Match) => {
      const pid = playerSession?.playerId
      if (!pid) return
      const opponentName = match.player1.id === pid ? match.player2.name : match.player1.name
      const tableLabel = match.tableNumber ? ` · Table ${match.tableNumber}` : ""

      toast.success("You've been paired!", {
        description: `vs ${opponentName}${tableLabel}`,
        duration: 8000,
      })

      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification("You've been paired!", {
          body: `vs ${opponentName}${tableLabel} — tap to open`,
          icon: "/icon-192.png",
        })
      }

      setHasNewPairing(true)
    },
    [playerSession?.playerId],
  )

  const { suppressRealtime } = useRealtime({
    tournamentId,
    isReady: !isLoading,
    setArenaState,
    currentPlayerId: playerSession?.playerId ?? null,
    onNewPairing: handleNewPairing,
    onTournamentStatusChange: (status) => {
      if (status === "completed") {
        setShowPodium(true)
      }
      if (status === "active" && effectivePlayerView) {
        setActiveTab("results")
      }
    },
    // Organizer auto-completes matches when both players submit the same result.
    // Player clients can't write to matches/players tables due to RLS.
    onAutoComplete: isOrganizer ? (matchId, winnerId, isDraw) => {
      if (DEBUG) console.log("[v0] Organizer auto-completing match from Realtime:", matchId)
      recordResult(matchId, winnerId, isDraw)
    } : undefined,
  })

  useEffect(() => {
    setPastGuestSessions(getGuestSessionHistory())
  }, [])

  // Trigger 1: Repeat play - guest/visitor with past sessions
  useEffect(() => {
    if (
      !isLoading &&
      pastGuestSessions.length > 0 &&
      (userRole === "guest-player" || userRole === "visitor") &&
      !getConversionPromptDismissed("repeat_play") &&
      !showConversionPrompt
    ) {
      setShowConversionPrompt("repeat_play")
    }
  }, [isLoading, pastGuestSessions.length, userRole, showConversionPrompt])

  // Trigger 3: Rated game - guest sees pairing in rated tournament
  const guestHasMatch =
    userRole === "guest-player" &&
    playerSession?.playerId &&
    arenaState.pairedMatches.some(
      (m) => m.player1.id === playerSession.playerId || m.player2.id === playerSession.playerId,
    )
  const tournamentUsesRatings = arenaState.settings.pairingAlgorithm === "balanced-strength"

  useEffect(() => {
    if (
      guestHasMatch &&
      tournamentUsesRatings &&
      !getConversionPromptDismissed("rated_game") &&
      !showConversionPrompt
    ) {
      setShowConversionPrompt("rated_game")
    }
  }, [guestHasMatch, tournamentUsesRatings, showConversionPrompt])

  useEffect(() => {
    const loadFromDatabase = async () => {
      if (!tournamentId) return

      if (DEBUG) console.log("[v0] Loading tournament from database:", tournamentId)

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        const { data: profileData } = await supabase
          .from("users")
          .select("name, rating, rating_band, country")
          .eq("id", user.id)
          .maybeSingle()
        if (profileData) {
          setUserName(profileData.name || "")
          setUserRating(profileData.rating ?? null)
          setUserRatingBand(profileData.rating_band ?? null)
          setUserCountry(profileData.country || null)
        }
      }

      const tournament = await loadTournament(tournamentId)
      if (tournament) {
        if (DEBUG) console.log("[v0] Found tournament:", tournament.name, "Status:", tournament.status)

        setOrganizerId(tournament.organizer_id || null)
        setTournamentMetadata({
          city: tournament.city,
          country: tournament.country,
          latitude: tournament.latitude,
          longitude: tournament.longitude,
          visibility: tournament.visibility || "public",
        })

        if (tournament.organizer_id) {
          const { data: organizerData } = await supabase
            .from("users")
            .select("name")
            .eq("id", tournament.organizer_id)
            .maybeSingle()
          if (organizerData) {
            setOrganizerName(organizerData.name)
          }
        }

        const dbPlayers = await loadPlayers(tournamentId)
        const dbMatches = await loadMatches(tournamentId)

        // Separate active matches (no result) from completed matches
        const activeMatches = dbMatches.filter((m) => !m.result?.completed)
        const completedMatches = dbMatches.filter((m) => m.result?.completed)

        if (DEBUG)
          console.log(
            "[v0] Loaded",
            dbPlayers.length,
            "players,",
            activeMatches.length,
            "active matches,",
            completedMatches.length,
            "completed matches",
          )

        if (user) {
          const playerMatch = dbPlayers.find((p) => p.userId === user.id)
          setCurrentPlayerInTournament(playerMatch || null)
        }

        // Fetch avatar URLs for players with userId
        const userIds = dbPlayers.map((p) => p.userId).filter((id): id is string => !!id)
        const avatarUrls = userIds.length > 0 ? await getAvatarUrls(userIds) : {}
        const enrichedPlayers = dbPlayers.map((p) =>
          p.userId && avatarUrls[p.userId]
            ? { ...p, avatarUrl: avatarUrls[p.userId] }
            : { ...p, avatarUrl: null }
        )

        // Convert start_time from ISO string to numeric timestamp
        const startTimeMs = tournament.start_time
          ? new Date(tournament.start_time).getTime()
          : null

        setArenaState((prev) => ({
          ...prev,
          players: enrichedPlayers.length > 0 ? enrichedPlayers : prev.players,
          tableCount: tournament.tables_count,
          settings:
            {
              ...tournament.settings,
              tableCount: tournament.tables_count, // Ensure tableCount is synced
            } || prev.settings,
          status: tournament.status,
          isActive: tournament.status === "active",
          pairedMatches: activeMatches,
          allTimeMatches: completedMatches,
          tournamentDuration: tournament.duration || TOURNAMENT_DURATION,
          tournamentStartTime: startTimeMs,
        }))
      } else {
        if (DEBUG) console.log("[v0] Tournament not found, initializing fresh state")
        setArenaState((prev) => ({
          ...prev,
          status: "setup",
        }))
      }

      setIsLoading(false)
    }

    loadFromDatabase()
  }, [tournamentId])

  // Load express-interest count, list (for organizer), and current user's interest
  useEffect(() => {
    if (!tournamentId) return
    let cancelled = false
    Promise.all([
      getInterestCount(tournamentId),
      isOrganizer ? getInterestedUsers(tournamentId) : Promise.resolve([]),
      currentUserId ? getUserInterested(tournamentId, currentUserId) : Promise.resolve(false),
    ]).then(([count, users, interested]) => {
      if (!cancelled) {
        setInterestCount(count)
        setInterestedUsers(users)
        setUserInterested(interested)
      }
    })
    return () => {
      cancelled = true
    }
  }, [tournamentId, isOrganizer, currentUserId])

  useEffect(() => {
    if (!tournamentId || isLoading || !isOrganizer) return

    const saveToDatabase = async () => {
      try {
        suppressRealtime()
        const statusToSave = arenaState.status === "completed" ? "completed" : arenaState.isActive ? "active" : "setup"
        const startTimeIso =
          arenaState.tournamentStartTime != null
            ? typeof arenaState.tournamentStartTime === "number"
              ? new Date(arenaState.tournamentStartTime).toISOString()
              : String(arenaState.tournamentStartTime)
            : undefined

        // RLS requires organizer_id = auth.uid() on insert/update; use current user when organizer not yet set (e.g. new tournament)
        await saveTournament(
          tournamentId,
          displayName,
          statusToSave,
          arenaState.tableCount,
          arenaState.settings,
          tournamentMetadata?.city,
          tournamentMetadata?.country,
          organizerId ?? currentUserId ?? undefined,
          tournamentMetadata?.latitude,
          tournamentMetadata?.longitude,
          tournamentMetadata?.visibility ?? "public",
          startTimeIso,
        )
        await savePlayers(tournamentId, arenaState.players)
        if (DEBUG) console.log("[v0] Tournament auto-saved to database")
      } catch (error) {
        console.error("[v0] Error auto-saving tournament:", error)
      }
    }

    const debounceTimer = setTimeout(saveToDatabase, 1000)
    return () => clearTimeout(debounceTimer)
  }, [
    tournamentId,
    displayName,
    arenaState.players,
    arenaState.isActive,
    arenaState.tableCount,
    arenaState.settings,
    arenaState.tournamentDuration,
    arenaState.status,
    arenaState.tournamentStartTime,
    tournamentMetadata,
    organizerId,
    currentUserId,
    isLoading,
    isOrganizer,
  ])

  useEffect(() => {
    if (!arenaState.isActive || !arenaState.tournamentStartTime) return

    const interval = setInterval(() => {
      const elapsed = Date.now() - arenaState.tournamentStartTime!
      const remaining = Math.max(0, arenaState.tournamentDuration - elapsed)
      setTimeRemaining(remaining)

      // Timer update - too chatty for normal logging

      if (remaining === 0 && !waitingForFinalResults) {
        endTournament()
      }
    }, 1000)

    // Calculate initial time remaining on mount
    const elapsed = Date.now() - arenaState.tournamentStartTime
    const remaining = Math.max(0, arenaState.tournamentDuration - elapsed)
    setTimeRemaining(remaining)

    return () => clearInterval(interval)
  }, [arenaState.isActive, arenaState.tournamentStartTime, arenaState.tournamentDuration, waitingForFinalResults])

  useEffect(() => {
    if (!arenaState.isActive || waitingForFinalResults) return

    // Get the algorithm for this tournament (default to all-vs-all for backwards compatibility)
    const algorithmId = arenaState.settings.pairingAlgorithm || "all-vs-all"
    const algorithm = getPairingAlgorithm(algorithmId)

    const pairingTimer = setInterval(() => {
      const activePairingMatches = arenaState.pairedMatches.filter((m) => !m.result?.completed)
      const hasVenue =
        tournamentMetadata?.latitude != null && tournamentMetadata?.longitude != null
      const availablePlayers = arenaState.players.filter(
        (p) =>
          !p.paused &&
          !p.markedForRemoval &&
          !p.markedForPause &&
          (p.checkedInAt != null || !hasVenue) && // Step 7: only checked-in players in pairing pool (or all if no venue)
          !activePairingMatches.some((m) => m.player1.id === p.id || m.player2.id === p.id),
      )

      const occupiedTables = getOccupiedTables()
      const availableTables = arenaState.tableCount - occupiedTables.length

      if (DEBUG)
        console.log(`[v0] ${algorithm.name}: Pairing check`, {
          algorithm: algorithm.id,
          totalPlayers: arenaState.players.length,
          availablePlayers: availablePlayers.length,
          activeMatches: activePairingMatches.length,
          totalTables: arenaState.tableCount,
          availableTables,
        })

      // Use algorithm-specific logic to determine if pairing should happen
      if (algorithm.shouldPair(availablePlayers, activePairingMatches, arenaState.players.length, availableTables)) {
        const maxMatches = Math.min(availableTables, Math.floor(availablePlayers.length / 2))

        // Use algorithm-specific pairing logic
        const newMatches = algorithm.createPairings(
          availablePlayers,
          arenaState.allTimeMatches,
          arenaState.settings,
          maxMatches,
        )

        if (newMatches.length > 0) {
          const matchesWithTables = assignTablesToMatches(newMatches)
          if (DEBUG)
            console.log(
              `[v0] ${algorithm.name}: Creating new matches:`,
              matchesWithTables.map((m) => `${m.player1.name} vs ${m.player2.name} (Table ${m.tableNumber})`),
            )

          setArenaState((prev) => ({
            ...prev,
            pairedMatches: [...prev.pairedMatches, ...matchesWithTables],
          }))
        }
      }
    }, algorithm.getPollingInterval()) // Use algorithm-specific polling interval

    return () => clearInterval(pairingTimer)
  }, [
    arenaState.isActive,
    arenaState.pairedMatches,
    arenaState.players,
    arenaState.allTimeMatches,
    arenaState.tableCount,
    arenaState.settings,
    tournamentMetadata?.latitude,
    tournamentMetadata?.longitude,
    waitingForFinalResults,
  ])

  useEffect(() => {
    const sessionData = localStorage.getItem("tournamentPlayer")
    if (DEBUG) console.log("[v0] Checking session data:", sessionData)
    if (sessionData) {
      try {
        const parsed: ArenaSessionData = JSON.parse(sessionData)
        if (DEBUG) {
          console.log("[v0] Parsed session:", parsed)
          console.log("[v0] Tournament ID match:", parsed.tournamentId, "===", initialTournamentId)
        }
        if (parsed.tournamentId === initialTournamentId && parsed.role === "player") {
          if (DEBUG) console.log("[v0] Setting player view mode")
          // setIsPlayerView(true) // Removed, now comes from props
          setPlayerSession(parsed)
          // Show welcome message for new players
          const hasSeenWelcome = localStorage.getItem(`welcome_${initialTournamentId}_${parsed.playerId}`)
          if (!hasSeenWelcome && arenaState.isActive) {
            setShowWelcomeMessage(true)
            localStorage.setItem(`welcome_${initialTournamentId}_${parsed.playerId}`, "true")
          }
        } else if (parsed.tournamentId === initialTournamentId && parsed.role === "organizer") {
          if (DEBUG) console.log("[v0] Setting organizer view mode")
          // setIsPlayerView(false) // Removed, now comes from props
        }
      } catch (err) {
        console.error("[v0] Error parsing session:", err)
        // setIsPlayerView(false) // Removed, now comes from props
      }
    } else {
      if (DEBUG) console.log("[v0] No session found, defaulting to organizer view")
      // setIsPlayerView(false) // Removed, now comes from props
    }
  }, [initialTournamentId, arenaState.isActive])


  useEffect(() => {
    if (!tournamentId || arenaState.status === "completed" || activeTab !== "players") return

    const refreshPlayers = async () => {
      try {
        const dbPlayers = await loadPlayers(tournamentId)

        setArenaState((prev) => {
          // Merge database players with local state
          // Keep local state for existing players (they may have been paused/modified)
          // Add new players from database that aren't in local state
          const existingPlayerIds = new Set(prev.players.map((p) => p.id))
          const newPlayers = dbPlayers.filter((p) => !existingPlayerIds.has(p.id))

          if (newPlayers.length > 0) {
            if (DEBUG)
              console.log(
                "[v0] New players joined:",
                newPlayers.map((p) => p.name),
              )
            return {
              ...prev,
              players: [...prev.players, ...newPlayers],
            }
          }

          return prev
        })
      } catch (error) {
        console.error("[v0] Error refreshing players:", error)
      }
    }

    // Refresh every 5 seconds when on Players tab
    const interval = setInterval(refreshPlayers, 5000)

    // Also refresh immediately when switching to Players tab
    refreshPlayers()

    return () => clearInterval(interval)
  }, [tournamentId, arenaState.status, activeTab])

  useEffect(() => {
    if (!tournamentId || !arenaState.isActive || !isOrganizer) return

    // Save all active (non-completed) matches
    const activeMatches = arenaState.pairedMatches.filter((m) => !m.result?.completed)
    if (activeMatches.length > 0) {
      suppressRealtime()
      saveMatches(tournamentId, activeMatches).catch((err) => console.error("[v0] Failed to save active matches:", err))
    }
  }, [arenaState.pairedMatches.length, tournamentId, arenaState.isActive, isOrganizer])

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const addPlayer = async (name: string, userId?: string, isGuest = false, addToGuestHistory = false) => {
    if (!name.trim()) return

    const isDuplicate = arenaState.players.some((player) => {
      if (userId && player.userId === userId) {
        return true // Same registered user
      }
      if (player.name.toLowerCase() === name.toLowerCase()) {
        return true // Same name
      }
      return false
    })

    if (isDuplicate) {
      alert("This player is already in the tournament.")
      return
    }

    if (arenaState.isActive && !arenaState.settings.allowLateJoin) {
      alert("Late joins are not allowed in this tournament. Please wait for the next tournament.")
      return
    }

    if (arenaState.isActive) {
      const newTotalPlayers = arenaState.players.length + 1
      const maxSimultaneousPairings = Math.floor(newTotalPlayers / 2)

      if (maxSimultaneousPairings > arenaState.tableCount) {
        alert(
          `Cannot add player: Maximum simultaneous pairings (${maxSimultaneousPairings}) would exceed available tables (${arenaState.tableCount})`,
        )
        return
      }
    }

    const newPlayer: Player = {
      id: `p-${Date.now()}`,
      name,
      score: 0,
      gamesPlayed: 0,
      streak: 0,
      performance: 0,
      opponentIds: [],
      gameResults: [],
      pieceColors: [],
      active: arenaState.isActive,
      paused: false,
      joinedAt: Date.now(),
      userId: userId || null,
      isGuest: isGuest,
      rating: resolveRating(userRating, userRatingBand ?? undefined),
      buchholz: 0,
      sonnebornBerger: 0,
      country: userCountry,
    }

    setArenaState((prev) => ({
      ...prev,
      players: [...prev.players, newPlayer],
    }))
    setPlayerNameInput("")

    if (tournamentId) {
      try {
        const supabase = createClient()
        const deviceId = addToGuestHistory ? getDeviceId() : null
        const { error: insertErr } = await supabase.from("players").insert({
          id: newPlayer.id,
          tournament_id: tournamentId,
          name: newPlayer.name,
          user_id: userId || null,
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
          rating: newPlayer.rating,
          buchholz: 0,
          sonneborn_berger: 0,
          is_paused: false,
          is_removed: false,
          country: newPlayer.country,
          device_id: deviceId,
        })
        if (insertErr) {
          if (insertErr.code === "23505") {
            toast.error("You've already joined this tournament from this device.")
            setArenaState((prev) => ({
              ...prev,
              players: prev.players.filter((p) => p.id !== newPlayer.id),
            }))
            return
          }
          console.error("[v0] Error saving player to database:", insertErr)
        }
      } catch (error) {
        console.error("[v0] Error saving player to database:", error)
      }
      if (isGuest && tournamentId && addToGuestHistory) {
        addGuestSession({
          tournamentId,
          playerId: newPlayer.id,
          displayName: name,
        })
      }
    }
  }

  const handleSelectUser = async (user: { id: string; name: string; rating: number | null }) => {
    await addPlayer(user.name, user.id, false)
  }

  // The following function is updated to use the new helper
  const handleAddGuestPlayer = async () => {
    const existingNames = arenaState.players.map((p) => p.name)
    const guestUsername = generateGuestUsername(existingNames)
    // Only add to guest history when the visitor adds themselves (!currentUserId), not when organizer adds a guest
    await addPlayer(guestUsername, undefined, true, !currentUserId)
  }

  const handleToggleInterest = async () => {
    if (!tournamentId) return
    setTogglingInterest(true)
    try {
      const result = await toggleInterest(tournamentId)
      if (!result.ok) {
        toast.error(result.error ?? "Could not update interest")
        return
      }
      setInterestCount(result.count)
      setUserInterested(result.interested)
      if (isOrganizer) {
        const users = await getInterestedUsers(tournamentId)
        setInterestedUsers(users)
      }
    } finally {
      setTogglingInterest(false)
    }
  }

  const handleCheckIn = async () => {
    if (!tournamentId) return
    setCheckingIn(true)
    const tryCheckIn = (): Promise<boolean> =>
      new Promise((resolve) => {
        if (!navigator.geolocation) {
          toast.error("Location is not available")
          resolve(false)
          return
        }
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const result = await verifyAndCheckIn(tournamentId, position.coords.latitude, position.coords.longitude)
            if (!result.ok) {
              toast.error(result.error)
              resolve(false)
              return
            }
            toast.success("You're checked in!")
            setArenaState((prev) => ({
              ...prev,
              players: prev.players.map((p) =>
                p.userId === currentUserId
                  ? { ...p, checkedInAt: Date.now(), presenceSource: "gps" as const }
                  : p,
              ),
            }))
            resolve(true)
          },
          () => {
            toast.info("Location unavailable. Ask the organizer to mark you present at the venue.")
            resolve(false)
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        )
      })
    const ok = await tryCheckIn()
    if (!ok) {
      toast.info("Retrying in 2 seconds...")
      await new Promise((r) => setTimeout(r, 2000))
      await tryCheckIn()
    }
    setCheckingIn(false)
  }

  const handleMarkPresent = async (playerId: string) => {
    if (!tournamentId) return
    setMarkingPresentPlayerId(playerId)
    try {
      const result = await markPresentOverride(tournamentId, playerId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Player marked present")
      const now = Date.now()
      setArenaState((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.id === playerId ? { ...p, checkedInAt: now, presenceSource: "override" as const } : p,
        ),
      }))
    } finally {
      setMarkingPresentPlayerId(null)
    }
  }

  const handleRenamePlayer = async (playerId: string, newName: string) => {
    if (!tournamentId) return
    setRenamingPlayerId(playerId)
    try {
      const result = await renamePlayer(tournamentId, playerId, newName)
      if (!result.success) throw new Error(result.error)
      toast.success("Player renamed")
      setArenaState((prev) => ({
        ...prev,
        players: prev.players.map((p) => (p.id === playerId ? { ...p, name: newName } : p)),
        pairedMatches: prev.pairedMatches.map((m) => ({
          ...m,
          player1: m.player1.id === playerId ? { ...m.player1, name: newName } : m.player1,
          player2: m.player2.id === playerId ? { ...m.player2, name: newName } : m.player2,
        })),
      }))
    } finally {
      setRenamingPlayerId(null)
    }
  }

  const joinAsSelf = async () => {
    if (!currentUserId || !userName) return

    if (arenaState.status === "completed") {
      toast.error("This tournament has ended. You can no longer join.")
      return
    }

    if (arenaState.isActive && !arenaState.settings.allowLateJoin) {
      toast.error("Late joins are not allowed in this tournament.")
      return
    }

    if (arenaState.isActive) {
      const newTotalPlayers = arenaState.players.filter((p) => !p.hasLeft).length + 1
      const maxPairings = Math.floor(newTotalPlayers / 2)
      if (maxPairings > arenaState.tableCount) {
        toast.error(`Cannot join: all ${arenaState.tableCount} tables are full.`)
        return
      }
    }

    if (isCurrentUserInTournament) {
      toast.error("You are already in this tournament")
      return
    }

    const existingPlayer = arenaState.players.find(
      (p) => p.name.toLowerCase() === userName.toLowerCase() && !p.hasLeft,
    )
    if (existingPlayer) {
      toast.error("A player with this name is already in the tournament")
      return
    }

    const nameTaken = tournamentId ? await playerNameExistsInTournament(tournamentId, userName) : false
    if (nameTaken) {
      toast.error(
        `${userName} already exists in this tournament. Try a different name, e.g. ${userName} R. or ${userName} (Madrid).`,
      )
      return
    }

    const hasVenue =
      tournamentMetadata?.latitude != null && tournamentMetadata?.longitude != null
    let checkedInAt: number | null = null
    let presenceSource: "gps" | null = null

    if (hasVenue && tournamentId) {
      setJoiningSelf(true)
      const runProximity = (): Promise<{ checkedInAt: number | null; presenceSource: "gps" | null }> =>
        new Promise((resolve) => {
          if (!navigator.geolocation) {
            toast.info("Location unavailable. You can still join; the organizer will confirm you at the venue.")
            resolve({ checkedInAt: null, presenceSource: null })
            return
          }
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const result = await checkVenueProximity(
                tournamentId!,
                position.coords.latitude,
                position.coords.longitude,
              )
              if (!result.ok) {
                toast.info("You're not at the venue yet. You can still join; the organizer will confirm you when you arrive.")
                resolve({ checkedInAt: null, presenceSource: null })
                return
              }
              resolve({ checkedInAt: Date.now(), presenceSource: "gps" })
            },
            () => {
              toast.info("Location unavailable. You can still join; the organizer will confirm you at the venue.")
              resolve({ checkedInAt: null, presenceSource: null })
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
          )
        })
      const proximity = await runProximity()
      checkedInAt = proximity.checkedInAt
      presenceSource = proximity.presenceSource
      setJoiningSelf(false)
    }

    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name: userName,
      rating: resolveRating(userRating, userRatingBand ?? undefined),
      score: 0,
      buchholz: 0,
      sonnebornBerger: 0,
      country: userCountry,
      isGuest: false,
      userId: currentUserId,
      gamesPlayed: 0,
      streak: 0,
      performance: 0,
      opponentIds: [],
      gameResults: [],
      pieceColors: [],
      active: arenaState.isActive,
      paused: false,
      joinedAt: Date.now(),
      checkedInAt: checkedInAt,
      presenceSource: presenceSource,
    }

    setArenaState((prev) => ({
      ...prev,
      players: [...prev.players, newPlayer],
    }))

    if (tournamentId) {
      try {
        const supabase = createClient()
        await supabase.from("players").insert({
          id: newPlayer.id,
          tournament_id: tournamentId,
          name: newPlayer.name,
          user_id: currentUserId,
          is_guest: false,
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
          rating: newPlayer.rating,
          buchholz: newPlayer.buchholz ?? 0,
          sonneborn_berger: newPlayer.sonnebornBerger ?? 0,
          country: newPlayer.country,
          checked_in_at: checkedInAt != null ? new Date(checkedInAt).toISOString() : null,
          presence_source: presenceSource,
        })
      } catch (error) {
        console.error("[v0] Error saving player to database:", error)
      }
    }
  }

  const removePlayer = (playerId: string) => {
    if (DEBUG) console.log("[v0] Attempting to remove player:", playerId)

    // Check if user has permission to remove this player
    const playerToRemove = arenaState.players.find((p) => p.id === playerId)

    if (!playerToRemove) {
      if (DEBUG) console.log("[v0] Player not found:", playerId)
      return
    }

    if (DEBUG) console.log("[v0] Player to remove:", playerToRemove.name, "isOrganizer:", isOrganizer)

    // Only organizer can remove others, players can only remove themselves
    if (!isOrganizer) {
      // Check if this is the current player removing themselves
      const isRemovingSelf = currentPlayerInTournament?.id === playerId
      if (!isRemovingSelf) {
        if (DEBUG) console.log("[v0] Permission denied: only organizer can remove other players")
        return
      }
    }

    if (arenaState.status === "active" && playerToRemove) {
      if (DEBUG) console.log("[v0] Marking player as removed (tournament active)")
      setArenaState((prev) => ({
        ...prev,
        players: prev.players.map((p) => (p.id === playerId ? { ...p, markedForRemoval: true, paused: true } : p)),
      }))
    } else {
      // During setup, actually remove the player
      if (DEBUG) console.log("[v0] Removing player from list (tournament setup)")
      setArenaState((prev) => ({
        ...prev,
        players: prev.players.filter((p) => p.id !== playerId),
      }))
    }

    if (tournamentId) {
      setTimeout(async () => {
        try {
          const supabase = createClient()

          if (arenaState.status === "active") {
            if (DEBUG) console.log("[v0] Marking player as removed in database")
            const { error } = await supabase
              .from("players")
              .update({
                paused: true,
                is_removed: true,
              })
              .eq("id", playerId)
              .eq("tournament_id", tournamentId)

            if (error) {
              console.error("[v0] Failed to mark player as removed in database:", error)
            } else {
              if (DEBUG) console.log("[v0] Player marked as removed in database successfully")
            }
          } else {
            // Delete player from database during setup
            if (DEBUG) console.log("[v0] Deleting player from database")
            const { error } = await supabase
              .from("players")
              .delete()
              .eq("id", playerId)
              .eq("tournament_id", tournamentId)

            if (error) {
              console.error("[v0] Failed to delete player from database:", error)
            } else {
              if (DEBUG) console.log("[v0] Player deleted from database successfully")
            }
          }
        } catch (error) {
          console.error("[v0] Error saving player removal:", error)
        }
      }, 100)
    }
  }

  const handleStartTournament = async () => {
    if (arenaState.status === "completed") {
      alert("This tournament has already been completed and cannot be restarted.")
      return
    }

    if (arenaState.players.length < 2) {
      alert("Need at least 2 players to start")
      return
    }

    const tableCount = Number.parseInt(tableCountInput)
    if (!tableCount || tableCount < 1) {
      alert("Please enter a valid number of tables (at least 1)")
      return
    }

    const maxSimultaneousPairings = Math.floor(arenaState.players.length / 2)
    if (tableCount < maxSimultaneousPairings) {
      alert(
        `Not enough tables! With ${arenaState.players.length} players, you need at least ${maxSimultaneousPairings} tables for all possible simultaneous pairings.`,
      )
      return
    }

    const durationMinutes = Number.parseInt(tournamentDurationInput)
    if (!durationMinutes || durationMinutes < 1) {
      alert("Please enter a valid tournament duration (at least 1 minute)")
      return
    }
    const durationMs = durationMinutes * 60 * 1000

    if (!tournamentId) {
      console.error("[v0] No tournament ID available - this should not happen with new routing")
      return
    }

    // Call server action to start tournament (validates auth + sets DB status)
    try {
      const { startTournament: startTournamentAction } = await import("@/app/actions/start-tournament")
      const result = await startTournamentAction(tournamentId)

      if (!result.success) {
        alert(result.error || "Failed to start tournament")
        return
      }
    } catch (error) {
      console.error("[v0] Error calling startTournament action:", error)
      alert("Failed to start tournament. Please try again.")
      return
    }

    // Update local state with additional data (tables, duration)
    const newTables = tableCount > 0 ? tableCount : Math.floor(arenaState.players.length / 2)
    setArenaState((prev) => ({
      ...prev,
      status: "active",
      isActive: true,
      tableCount: newTables,
      settings: {
        ...prev.settings,
        tableCount: newTables,
      },
      tournamentStartTime: Date.now(),
      tournamentDuration: durationMs,
    }))
    setTimeRemaining(durationMs)

    setActiveTab("pairings")
  }

  const endTournament = () => {
    setShowEndDialog(true)
  }

  const handleEndImmediately = async () => {
    setShowEndDialog(false)
    await finalizeEndTournament()
  }

  const handleWaitForFinalResults = () => {
    setShowEndDialog(false)
    setWaitingForFinalResults(true)
  }

  const finalizeEndTournament = async () => {
    setShowPodium(true)
    setArenaState((prev) => ({
      ...prev,
      isActive: false,
      status: "completed",
      pairedMatches: [], // Clear active matches when ending tournament
    }))
    setWaitingForFinalResults(false)

    if (tournamentId) {
      try {
        const startTimeIso =
          arenaState.tournamentStartTime != null
            ? typeof arenaState.tournamentStartTime === "number"
              ? new Date(arenaState.tournamentStartTime).toISOString()
              : String(arenaState.tournamentStartTime)
            : undefined

        await saveTournament(
          tournamentId,
          displayName,
          "completed",
          arenaState.tableCount,
          arenaState.settings,
          tournamentMetadata?.city,
          tournamentMetadata?.country,
          organizerId ?? currentUserId ?? undefined,
          tournamentMetadata?.latitude,
          tournamentMetadata?.longitude,
          tournamentMetadata?.visibility ?? "public",
          startTimeIso,
        )

        const allMatchesToSave = mergeMatchesForSave(arenaState.pairedMatches, arenaState.allTimeMatches)
        await saveMatches(tournamentId, allMatchesToSave)
        if (DEBUG) console.log("[v0] Tournament ended and saved as completed")
      } catch (error) {
        console.error("[v0] Error saving tournament end:", error)
      }
    }
  }

  const closePodium = () => {
    setShowPodium(false)
  }

  const recordResult = async (matchId: string, winnerId: string | undefined, isDraw: boolean) => {
    if (DEBUG) console.log("[v0] Recording result for match:", matchId, "isDraw:", isDraw, "winnerId:", winnerId)

    let newPairedMatches = []
    let newAllTimeMatches = []
    let newPlayers = []

    setArenaState((prev) => {
      const matchIndex = prev.pairedMatches.findIndex((m) => m.id === matchId)
      if (matchIndex === -1) return prev

      const match = prev.pairedMatches[matchIndex]
      const updatedMatch = {
        ...match,
        endTime: Date.now(), // Track when result was entered
        result: {
          winnerId,
          isDraw,
          completed: true,
          completedAt: Date.now(),
        },
      }

      newPlayers = prev.players.map((player) => {
        if (player.id !== match.player1.id && player.id !== match.player2.id) {
          return player
        }

        const isPlayer1 = player.id === match.player1.id
        const isWinner = winnerId === player.id
        const opponent = isPlayer1 ? match.player2 : match.player1

        const currentStreak = player.streak
        let newStreak = player.streak

        if (isDraw) {
          newStreak = 0
        } else if (isWinner) {
          newStreak = player.streak + 1
        } else {
          newStreak = 0
        }

        const points = calculatePointsFromSettings(isWinner, isDraw, currentStreak, prev.settings)

        let gameResult: "W" | "D" | "L"
        if (isDraw) {
          gameResult = "D"
        } else if (isWinner) {
          gameResult = "W"
        } else {
          gameResult = "L"
        }

        const pieceColor: "white" | "black" = isPlayer1 ? "white" : "black"

        return {
          ...player,
          score: player.score + points,
          gamesPlayed: player.gamesPlayed + 1,
          streak: newStreak,
          opponentIds: [...player.opponentIds, opponent.id],
          gameResults: [...player.gameResults, gameResult],
          pieceColors: [...player.pieceColors, pieceColor],
          tableNumbers: [...(player.tableNumbers || []), match.tableNumber || 0],
        }
      })

      // so both players become available for next pairing
      if (prev.settings.pairingAlgorithm === "balanced-strength") {
        newPairedMatches = prev.pairedMatches.filter((m) => m.id !== matchId)
      } else {
        // For all-vs-all, keep completed matches in pairedMatches until round completes
        newPairedMatches = [...prev.pairedMatches]
        newPairedMatches[matchIndex] = updatedMatch
      }

      newAllTimeMatches = [...prev.allTimeMatches, updatedMatch]

      if (waitingForFinalResults) {
        const remainingMatches = newPairedMatches.filter((m) => m.id !== matchId && !m.result?.completed)

        // If no more active matches, end tournament
        if (remainingMatches.length === 0) {
          if (DEBUG) console.log("[v0] All final results entered, ending tournament")
          setTimeout(() => finalizeEndTournament(), 500) // Small delay for state to settle
        }
      }

      newPlayers = newPlayers.map((player) => {
        const hadMatchJustCompleted = updatedMatch.player1.id === player.id || updatedMatch.player2.id === player.id

        if (hadMatchJustCompleted) {
          // Apply marked for removal
          if (player.markedForRemoval) {
            if (DEBUG) console.log("[v0] Applying deferred removal for:", player.name)
            return { ...player, hasLeft: true, active: false }
          }
          // Apply marked for pause
          if (player.markedForPause) {
            if (DEBUG) console.log("[v0] Applying deferred pause for:", player.name)
            return { ...player, paused: true, markedForPause: false }
          }
        }
        return player
      })

      if (tournamentId && isOrganizer) {
        savePlayers(tournamentId, newPlayers).catch((err) => {
          console.error("[v0] Error saving players after match completion:", err)
        })
        saveMatches(tournamentId, mergeMatchesForSave(newPairedMatches, newAllTimeMatches)).catch((err) => {
          console.error("[v0] Error saving matches after match completion:", err)
        })
      }

      return {
        ...prev,
        pairedMatches: newPairedMatches,
        allTimeMatches: newAllTimeMatches,
        players: newPlayers,
      }
    })
  }

  // Renamed from recordResult to match the update's function name
  const recordMatchResult = (matchId: string, winnerId: string | undefined, isDraw: boolean) => {
    if (DEBUG) console.log("[v0] Recording result for match:", matchId, "isDraw:", isDraw, "winnerId:", winnerId)

    let newPairedMatches = []
    let newAllTimeMatches = []
    let newPlayers = []

    setArenaState((prev) => {
      const matchIndex = prev.pairedMatches.findIndex((m) => m.id === matchId)
      if (matchIndex === -1) return prev

      const match = prev.pairedMatches[matchIndex]
      const updatedMatch = {
        ...match,
        endTime: Date.now(), // Track when result was entered
        result: {
          winnerId,
          isDraw,
          completed: true,
          completedAt: Date.now(),
        },
      }

      newPlayers = prev.players.map((player) => {
        if (player.id !== match.player1.id && player.id !== match.player2.id) {
          return player
        }

        const isPlayer1 = player.id === match.player1.id
        const isWinner = winnerId === player.id
        const opponent = isPlayer1 ? match.player2 : match.player1

        const currentStreak = player.streak
        let newStreak = player.streak

        if (isDraw) {
          newStreak = 0
        } else if (isWinner) {
          newStreak = player.streak + 1
        } else {
          newStreak = 0
        }

        const points = calculatePointsFromSettings(isWinner, isDraw, currentStreak, prev.settings)

        let gameResult: "W" | "D" | "L"
        if (isDraw) {
          gameResult = "D"
        } else if (isWinner) {
          gameResult = "W"
        } else {
          gameResult = "L"
        }

        const pieceColor: "white" | "black" = isPlayer1 ? "white" : "black"

        return {
          ...player,
          score: player.score + points,
          gamesPlayed: player.gamesPlayed + 1,
          streak: newStreak,
          opponentIds: [...player.opponentIds, opponent.id],
          gameResults: [...player.gameResults, gameResult],
          pieceColors: [...player.pieceColors, pieceColor],
          tableNumbers: [...(player.tableNumbers || []), match.tableNumber || 0],
        }
      })

      // so both players become available for next pairing
      if (prev.settings.pairingAlgorithm === "balanced-strength") {
        newPairedMatches = prev.pairedMatches.filter((m) => m.id !== matchId)
      } else {
        // For all-vs-all, keep completed matches in pairedMatches until round completes
        newPairedMatches = [...prev.pairedMatches]
        newPairedMatches[matchIndex] = updatedMatch
      }

      newAllTimeMatches = [...prev.allTimeMatches, updatedMatch]

      if (waitingForFinalResults) {
        const remainingMatches = newPairedMatches.filter((m) => m.id !== matchId && !m.result?.completed)

        // If no more active matches, end tournament
        if (remainingMatches.length === 0) {
          if (DEBUG) console.log("[v0] All final results entered, ending tournament")
          setTimeout(() => finalizeEndTournament(), 500) // Small delay for state to settle
        }
      }

      // Remove players marked for removal
      const playersAfterRemoval = prev.players.filter((p) => !p.markedForRemoval)

      // Also update in pairedMatches (remove marked players from future rounds)
      const updatedPairedMatches = prev.pairedMatches.map((m) => ({
        ...m,
        player1: m.player1.markedForRemoval ? { ...m.player1, markedForRemoval: false } : m.player1,
        player2: m.player2.markedForRemoval ? { ...m.player2, markedForRemoval: false } : m.player2,
      }))

      if (tournamentId && isOrganizer) {
        savePlayers(tournamentId, playersAfterRemoval).catch((err) => {
          console.error("[v0] Error saving players after result:", err)
        })
        saveMatches(tournamentId, mergeMatchesForSave(updatedPairedMatches, newAllTimeMatches)).catch((err) => {
          console.error("[v0] Error saving matches after result:", err)
        })
      }

      return {
        ...prev,
        players: playersAfterRemoval,
        pairedMatches: updatedPairedMatches,
        allTimeMatches: newAllTimeMatches,
      }
    })
  }

  const analyzeRematches = () => {
    const pairings = new Map<string, number>()

    arenaState.players.forEach((player) => {
      player.opponentIds.forEach((opponentId, index) => {
        const pair = [player.id, opponentId].sort().join(" vs ")
        pairings.set(pair, (pairings.get(pair) || 0) + 1)
      })
    })

    const uniquePairings = new Map<string, number>()
    pairings.forEach((count, pair) => {
      uniquePairings.set(pair, Math.ceil(count / 2))
    })

    const rematches = Array.from(uniquePairings.entries())
      .filter(([_, count]) => count > 1)
      .map(([pair, count]) => {
        const [id1, id2] = pair.split(" vs ")
        const player1 = arenaState.players.find((p) => p.id === id1)
        const player2 = arenaState.players.find((p) => p.id === id2)
        return {
          players: `${player1?.name} vs ${player2?.name}`,
          count,
        }
      })

    if (DEBUG) console.log("[v0] REMATCH ANALYSIS:", {
      totalUniquePairings: uniquePairings.size,
      totalRematches: rematches.length,
      rematchDetails: rematches.length > 0 ? rematches : "No rematches detected",
    })

    alert(
      `Rematch Analysis:\nTotal unique pairings: ${uniquePairings.size}\nRematches found: ${rematches.length}\n\n${rematches.length > 0 ? rematches.map((r) => `${r.players}: ${r.count} times`).join("\n") : "No rematches detected!"}`,
    )

    return rematches
  }

  const togglePause = (playerId: string) => {
    const player = arenaState.players.find((p) => p.id === playerId)
    if (!player) return

    if (
      !player.paused &&
      !player.markedForPause &&
      !confirm(`Pause ${player.name}? They won't be paired until resumed.`)
    ) {
      return
    }

    const isSelfPause = !isOrganizer && (playerId === currentPlayerInTournament?.id || playerId === playerSession?.playerId)

    if (!player.paused && isSelfPause && !arenaState.settings.allowSelfPause) {
      alert("Self-pause is not allowed in this tournament.")
      return
    }

    if (!player.paused && isSelfPause && player.gamesPlayed < arenaState.settings.minGamesBeforePause) {
      alert(`Players must complete at least ${arenaState.settings.minGamesBeforePause} games before pausing.`)
      return
    }

    const isCurrentlyPaired = arenaState.pairedMatches.some(
      (m) => !m.result?.completed && (m.player1.id === playerId || m.player2.id === playerId),
    )

    if (!player.paused && isCurrentlyPaired) {
      setArenaState((prev) => ({
        ...prev,
        players: prev.players.map((p) => (p.id === playerId ? { ...p, markedForPause: !p.markedForPause } : p)),
      }))
      if (tournamentId) {
        const supabase = createClient()
        supabase
          .from("players")
          .update({ is_paused: !player.markedForPause })
          .eq("id", playerId)
          .eq("tournament_id", tournamentId)
          .then(({ error }) => { if (error) console.error("[v0] Failed to persist is_paused:", error) })
      }
    } else {
      const newPaused = !player.paused
      setArenaState((prev) => ({
        ...prev,
        players: prev.players.map((p) => (p.id === playerId ? { ...p, paused: newPaused, markedForPause: false } : p)),
      }))
      if (tournamentId) {
        const supabase = createClient()
        supabase
          .from("players")
          .update({ paused: newPaused, is_paused: false })
          .eq("id", playerId)
          .eq("tournament_id", tournamentId)
          .then(({ error }) => { if (error) console.error("[v0] Failed to persist pause:", error) })
      }
    }
  }

  const getOccupiedTables = () => {
    return arenaState.pairedMatches.filter((m) => !m.result?.completed && m.tableNumber).map((m) => m.tableNumber!)
  }

  const getNextAvailableTable = (): number | undefined => {
    const occupiedTables = getOccupiedTables()
    for (let i = 1; i <= arenaState.tableCount; i++) {
      if (!occupiedTables.includes(i)) {
        return i
      }
    }
    return undefined
  }

  const assignTablesToMatches = (matches: Match[]) => {
    const sortedMatches = [...matches].sort((a, b) => {
      const scoreA = a.player1.score + a.player2.score
      const scoreB = b.player1.score + b.player2.score
      return scoreB - scoreA
    })

    const occupiedTables = getOccupiedTables()
    const availableTables = Array.from({ length: arenaState.tableCount }, (_, i) => i + 1).filter(
      (t) => !occupiedTables.includes(t),
    )

    return sortedMatches.map((match, index) => ({
      ...match,
      tableNumber: availableTables[index],
    }))
  }

  const activePlayers = arenaState.players.filter(
    (p) => p.active && !p.paused && !p.markedForRemoval && !p.markedForPause,
  ).length
  const inProgress = arenaState.pairedMatches.filter((m) => !m.result?.completed).length
  const maxSimultaneousPairings = Math.floor(arenaState.players.length / 2)
  const pendingMatches = arenaState.pairedMatches.filter((m) => !m.result?.completed)
  const sortedPendingMatches = [...pendingMatches].sort((a, b) => {
    if (a.tableNumber && b.tableNumber) {
      return a.tableNumber - b.tableNumber
    }
    return 0
  })

  const calculatePointsFromSettings = (
    isWinner: boolean,
    isDraw: boolean,
    currentStreak: number,
    settings: typeof arenaState.settings,
  ) => {
    let basePoints = 0

    if (isDraw) {
      basePoints = settings.drawPoints
    } else if (isWinner) {
      basePoints = settings.winPoints
    } else {
      basePoints = settings.lossPoints
    }

    if (settings.streakEnabled && currentStreak >= 2) {
      return basePoints * settings.streakMultiplier
    }

    return basePoints
  }

  const handlePlayerSubmit = async (matchId: string, result: "player1-win" | "draw" | "player2-win") => {
    if (DEBUG) console.log("[v0] Player submitting result:", matchId, result)
    if (!playerSession) {
      if (DEBUG) console.log("[v0] No player session, rejecting submission")
      return
    }

    const match = arenaState.pairedMatches.find((m) => m.id === matchId)
    if (!match) {
      if (DEBUG) console.log("[v0] Match not found, rejecting submission")
      return
    }

    const isPlayerInMatch = match.player1.id === playerSession.playerId || match.player2.id === playerSession.playerId
    if (!isPlayerInMatch) {
      if (DEBUG) console.log("[v0] Player not in match, rejecting submission")
      alert("You can only submit results for your own matches.")
      return
    }

    // Store temporary submission (not yet confirmed)
    setPlayerSubmissions((prev) => ({
      ...prev,
      [matchId]: { result, confirmed: false },
    }))
  }

  const handlePlayerConfirm = async (matchId: string) => {
    if (DEBUG) console.log("[v0] Player confirming result:", matchId)
    if (!playerSession) return

    const match = arenaState.pairedMatches.find((m) => m.id === matchId)
    if (!match) return

    const isPlayerInMatch = match.player1.id === playerSession.playerId || match.player2.id === playerSession.playerId
    if (!isPlayerInMatch) {
      if (DEBUG) console.log("[v0] Player not in match, rejecting confirmation")
      return
    }

    const submission = playerSubmissions[matchId]
    if (!submission) return

    // Mark as confirmed in local state
    setPlayerSubmissions((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], confirmed: true },
    }))

    try {
      const { submitMatchResult } = await import("@/app/actions/submit-result")
      const response = await submitMatchResult(matchId, submission.result, true, playerSession.playerId)

      if (!response.success) {
        console.error("[v0] Server rejected submission:", response.error)
        alert(response.error || "Failed to submit result")
        // Revert local state
        setPlayerSubmissions((prev) => ({
          ...prev,
          [matchId]: { ...prev[matchId], confirmed: false },
        }))
        return
      }

      // Trigger 2: Result affects rankings - guest submits result
      if (
        userRole === "guest-player" &&
        !getConversionPromptDismissed("result_rankings") &&
        !showConversionPrompt
      ) {
        setShowConversionPrompt("result_rankings")
      }

      const updatedMatch = response.match

      if (updatedMatch) {
        if (DEBUG) console.log("[v0] Match submission saved:", updatedMatch)

        // Immediately reflect the submission in arenaState so the UI
        // shows it without waiting for Realtime
        setArenaState((prev) => ({
          ...prev,
          pairedMatches: prev.pairedMatches.map((m) => {
            if (m.id !== matchId) return m
            return {
              ...m,
              player1Submission: updatedMatch.player1_submission
                ? { result: updatedMatch.player1_submission, confirmed: true, timestamp: Date.now() }
                : m.player1Submission,
              player2Submission: updatedMatch.player2_submission
                ? { result: updatedMatch.player2_submission, confirmed: true, timestamp: Date.now() }
                : m.player2Submission,
            }
          }),
        }))

        // Check if both players submitted matching results
        if (
          updatedMatch.player1_submission &&
          updatedMatch.player2_submission &&
          updatedMatch.player1_submission === updatedMatch.player2_submission
        ) {
          const isDraw = updatedMatch.player1_submission === "draw"
          const winnerId = isDraw
            ? undefined
            : updatedMatch.player1_submission === "player1-win"
              ? updatedMatch.player1_id
              : updatedMatch.player2_id

          recordResult(matchId, winnerId, isDraw)
        }
      }
    } catch (error) {
      console.error("[v0] Error saving player submission:", error)
      alert("Failed to submit result. Please try again.")
      // Revert local state
      setPlayerSubmissions((prev) => ({
        ...prev,
        [matchId]: { ...prev[matchId], confirmed: false },
      }))
    }
  }

  const handlePlayerCancel = (matchId: string) => {
    if (DEBUG) console.log("[v0] Player canceling submission:", matchId)
    // Remove temporary submission
    setPlayerSubmissions((prev) => {
      const updated = { ...prev }
      delete updated[matchId]
      return updated
    })
  }

  const overrideResult = async (playerId: string, gameIndex: number, newResult: "W" | "D" | "L") => {
    if (DEBUG) console.log("[v0] Overriding result for player:", playerId, "game:", gameIndex, "new result:", newResult)

    setArenaState((prev) => {
      const player = prev.players.find((p) => p.id === playerId)
      if (!player || gameIndex >= player.gameResults.length) {
        console.error("[v0] Invalid player or game index")
        return prev
      }

      const oldResult = player.gameResults[gameIndex]
      if (oldResult === newResult) {
        if (DEBUG) console.log("[v0] Result unchanged, no update needed")
        return prev
      }

      const opponentId = player.opponentIds[gameIndex]
      const opponent = prev.players.find((p) => p.id === opponentId)
      if (!opponent) {
        console.error("[v0] Opponent not found")
        return prev
      }

      // Find the corresponding game in opponent's history
      const opponentGameIndex = opponent.opponentIds.findIndex(
        (id, idx) => id === playerId && idx <= gameIndex && opponent.gameResults[idx] !== undefined,
      )

      if (opponentGameIndex === -1) {
        console.error("[v0] Could not find corresponding game in opponent's history")
        return prev
      }

      // Calculate point changes
      const calculatePointChange = (result: "W" | "D" | "L", streakBefore: number) => {
        const hasStreak = streakBefore >= 2
        if (result === "W") return hasStreak ? 4 : 2
        if (result === "D") return hasStreak ? 2 : 1
        return 0
      }

      // Calculate streak before this game for both players
      const playerStreakBefore =
        gameIndex === 0
          ? 0
          : player.gameResults.slice(0, gameIndex).reduce((streak, r, idx) => (r === "W" ? streak + 1 : 0), 0)

      const opponentStreakBefore =
        opponentGameIndex === 0
          ? 0
          : opponent.gameResults.slice(0, opponentGameIndex).reduce((streak, r, idx) => (r === "W" ? streak + 1 : 0), 0)

      // Calculate old and new points
      const oldPlayerPoints = calculatePointChange(oldResult, playerStreakBefore)
      const newPlayerPoints = calculatePointChange(newResult, playerStreakBefore)
      const pointDelta = newPlayerPoints - oldPlayerPoints

      // Determine opponent's new result (opposite of player's)
      const newOpponentResult: "W" | "D" | "L" = newResult === "W" ? "L" : newResult === "L" ? "W" : "D"
      const oldOpponentResult = opponent.gameResults[opponentGameIndex]
      const oldOpponentPoints = calculatePointChange(oldOpponentResult, opponentStreakBefore)
      const newOpponentPoints = calculatePointChange(newOpponentResult, opponentStreakBefore)
      const opponentPointDelta = newOpponentPoints - oldOpponentPoints

      // Update both players
      const updatedPlayers = prev.players.map((p) => {
        if (p.id === playerId) {
          const newGameResults = [...p.gameResults]
          newGameResults[gameIndex] = newResult
          return {
            ...p,
            score: p.score + pointDelta,
            gameResults: newGameResults,
          }
        }
        if (p.id === opponentId) {
          const newGameResults = [...opponent.gameResults]
          newGameResults[opponentGameIndex] = newOpponentResult
          return {
            ...opponent,
            score: opponent.score + opponentPointDelta,
            gameResults: newGameResults,
          }
        }
        return p
      })

      // Save to database
      if (tournamentId) {
        savePlayers(tournamentId, updatedPlayers).catch((err) => {
          console.error("[v0] Error saving players after override:", err)
        })
      }

      return {
        ...prev,
        players: updatedPlayers,
      }
    })
  }

  // New handler for settings update, toggles simulator visibility
  const handleUpdateSettings = async (newSettings: TournamentSettings) => {
    setArenaState((prev) => ({
      ...prev,
      settings: newSettings,
      tableCount: newSettings.tableCount, // Ensure tableCount is synced
    }))
    // Closing the settings dialog is handled by the caller (TournamentSettingsPanel)
    // setShowSettings(false); // Removed, handled in TournamentSettingsPanel
  }

  // Helper to consolidate match completion and applying marked actions
  const completeMatch = (matchId: string, result: MatchResult) => {
    setArenaState((prev) => {
      const updated = { ...prev }
      // Find and update the match
      const matchIndex = updated.pairedMatches.findIndex((m) => m.id === matchId)
      if (matchIndex !== -1) {
        updated.pairedMatches[matchIndex].result = result
      }

      updated.players = updated.players.map((player) => {
        // Check if this player had a match that just completed
        const hadMatchJustCompleted = updated.pairedMatches.some(
          (m) => m.id === matchId && m.result?.completed && (m.player1.id === player.id || m.player2.id === player.id),
        )

        if (hadMatchJustCompleted) {
          // Apply marked for removal
          if (player.markedForRemoval) {
            return { ...player, hasLeft: true, active: false } // Keep in list but mark as left
          }
          // Apply marked for pause
          if (player.markedForPause) {
            return { ...player, paused: true, markedForPause: false }
          }
        }
        return player
      })

      // Remove players that are marked as left
      updated.players = updated.players.filter((p) => !p.markedForRemoval || p.hasLeft)

      // Save updated player and match states (organizer only — players lack RLS write access)
      if (tournamentId && isOrganizer) {
        savePlayers(tournamentId, updated.players).catch((err) => {
          console.error("[v0] Error saving players after match completion:", err)
        })
        saveMatches(tournamentId, mergeMatchesForSave(updated.pairedMatches, updated.allTimeMatches)).catch((err) => {
          console.error("[v0] Error saving matches after match completion:", err)
        })
      }

      return updated
    })
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading tournament...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isFullScreenPairings) {
    return (
      <div className="fixed inset-0 z-50 overflow-auto bg-secondary">
        <div className="container mx-auto py-3 px-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold">Current Pairings</h1>
            <Button variant="outline" size="sm" onClick={() => setIsFullScreenPairings(false)}>
              <X className="h-4 w-4 mr-2" />
              Exit
            </Button>
          </div>

          {sortedPendingMatches.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {sortedPendingMatches.map((match) => (
                <div
                  key={match.id}
                  className="border-2 rounded-lg hover:bg-accent/50 transition-colors overflow-hidden"
                >
                  {match.tableNumber && (
                    <div className="bg-amber-700 px-3 py-1 flex items-center gap-2">
                      <span className="text-white font-bold text-sm">Table {match.tableNumber}</span>
                    </div>
                  )}
                  <div className="p-2 space-y-1">
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded px-2 py-1">
                      <div className="w-4 h-4 bg-white border-2 border-gray-300 rounded-sm flex-shrink-0" />
                      <span className="font-semibold text-sm break-words">{match.player1.name}</span>
                    </div>
                    <div className="text-center text-xs text-muted-foreground">vs</div>
                    <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded px-2 py-1">
                      <div className="w-4 h-4 bg-gray-900 border-2 border-gray-600 rounded-sm flex-shrink-0" />
                      <span className="font-semibold text-sm break-words">{match.player2.name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No active pairings. Waiting for more players to be available.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    )
  }

  return (
    // Updated background for better contrast with dialogs
    <div className="relative flex flex-col bg-background min-h-screen">
      {/* Added max-width container to constrain content width and center it */}
      <div className="max-w-4xl mx-auto w-full px-4 py-8">
        {showPodium && (
          <TournamentPodium
            players={arenaState.players}
            totalMatches={arenaState.allTimeMatches.length}
            onClose={closePodium}
          />
        )}

        {showSettings && (
          <TournamentSettingsPanel
            settings={arenaState.settings}
            onUpdateSettings={handleUpdateSettings}
            onClose={() => setShowSettings(false)}
            showSimulator={showSimulator}
            onToggleSimulator={(show) => setShowSimulator(show)}
            isOrganizer={isOrganizer}
          />
        )}

        {showConversionPrompt && (
          <ConversionPrompt
            open
            triggerKey={showConversionPrompt}
            onOpenChange={(open) => {
              if (!open) setShowConversionPrompt(null)
            }}
          />
        )}

        {showWelcomeMessage && effectivePlayerView && (
          <Card className="bg-primary/10 border-primary mb-4">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start gap-3">
                <Trophy className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Welcome, {playerSession?.playerName}!</p>
                  <p className="text-sm text-muted-foreground">
                    You've successfully joined the tournament. Check the Pairings tab to see your matches when they're
                    ready.
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowWelcomeMessage(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs
          value={activeTab}
          onValueChange={(tab) => {
            setActiveTab(tab)
            if (tab === "results") setHasNewPairing(false)
          }}
          className="w-full"
        >
          {/* Consolidate header elements */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 mb-1">
                <h1 className="text-xl sm:text-2xl font-bold truncate">{displayName}</h1>
                <Link href="/">
                  <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8 shrink-0">
                    <Home className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge variant="secondary" className="font-normal">
                  {userRole === "organizer"
                    ? "Organizer"
                    : userRole === "registered-player" || userRole === "guest-player"
                      ? "Player"
                      : "Visitor"}
                </Badge>
                {organizerName && (
                  <p className="text-sm text-muted-foreground">
                    Organized by <span className="font-semibold">{organizerName}</span>
                    {isOrganizer && <span className="text-primary ml-1">(You)</span>}
                  </p>
                )}
              </div>
              {tournamentMetadata?.latitude != null && tournamentMetadata?.longitude != null && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${tournamentMetadata.latitude},${tournamentMetadata.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-1"
                >
                  <MapPin className="h-4 w-4" />
                  Get directions
                </a>
              )}
              {arenaState.status === "completed" && (
                <p className="text-sm text-muted-foreground mt-1">Tournament Completed</p>
              )}
            </div>

            <TabsList
              className={`grid h-auto w-full sm:w-auto min-h-[44px] ${
                arenaState.status === "completed" ? "grid-cols-3" : "grid-cols-4"
              }`}
            >
              <TabsTrigger value="players" className="text-xs sm:text-sm min-h-[44px] px-2 sm:px-3">
                <Users className="h-4 w-4 mr-1" />
                Players
              </TabsTrigger>
              <TabsTrigger value="pairings" className="relative text-xs sm:text-sm min-h-[44px] px-2 sm:px-3">
                <Swords className="h-4 w-4 mr-1" />
                Pairings
                {arenaState.pairedMatches.some(
                  (m) =>
                    m.player1Submission?.confirmed &&
                    m.player2Submission?.confirmed &&
                    m.player1Submission.result !== m.player2Submission.result,
                ) && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                )}
              </TabsTrigger>
              {arenaState.status !== "completed" && (
                <TabsTrigger value="results" className="relative text-xs sm:text-sm min-h-[44px] px-2 sm:px-3">
                  <Trophy className="h-4 w-4 mr-1" />
                  Results
                  {(() => {
                    const hasConflict = arenaState.pairedMatches.some(
                      (m) =>
                        m.player1Submission?.confirmed &&
                        m.player2Submission?.confirmed &&
                        m.player1Submission.result !== m.player2Submission.result,
                    )
                    const hasSubmissions = arenaState.pairedMatches.some(
                      (m) => m.player1Submission?.confirmed || m.player2Submission?.confirmed,
                    )
                    if (hasConflict) {
                      return <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    }
                    if (hasNewPairing || hasSubmissions) {
                      return <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    }
                    return null
                  })()}
                </TabsTrigger>
              )}
              <TabsTrigger value="standings" className="text-xs sm:text-sm min-h-[44px] px-2 sm:px-3">
                <Award className="h-4 w-4 mr-1" />
                Standings
              </TabsTrigger>
            </TabsList>

            {arenaState.isActive && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-md">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">{formatTime(timeRemaining)}</span>
                </div>
                {arenaState.status === "active" && permissions.canEndTournament && (
                  <Button variant="destructive" size="sm" onClick={endTournament}>
                    End Tournament
                  </Button>
                )}
              </div>
            )}

            {permissions.canAccessSettings && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 bg-transparent"
                onClick={() => setShowSettings(true)}
                title="Tournament Settings"
              >
                <SettingsIcon className="h-4 w-4" />
              </Button>
            )}
          </div>

          <TabsContent value="players" className="space-y-2">
              {/* Express interest card — only for visitors who haven't joined yet */}
              {!isCurrentUserInTournament && !playerSession?.playerId && <Card className="mb-4 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-primary" />
                      Interest
                    </span>
                    {interestCount > 0 && (
                      <span className="text-muted-foreground font-normal">
                        {interestCount} {interestCount === 1 ? "person" : "people"} interested
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {currentUserId && (
                    <Button
                      variant={userInterested ? "secondary" : "outline"}
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={handleToggleInterest}
                      disabled={togglingInterest}
                    >
                      {togglingInterest ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Heart
                          className={cn("h-4 w-4 mr-2", userInterested && "fill-current")}
                        />
                      )}
                      {userInterested ? "Interested" : "I'm interested"}
                    </Button>
                  )}
                  {!currentUserId && interestCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <Link href="/auth/login" className="text-primary hover:underline">Sign in</Link> to express interest
                    </p>
                  )}
                  {isOrganizer && interestedUsers.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Interested</p>
                      <ul className="text-sm space-y-1">
                        {interestedUsers.map((u) => (
                          <li key={u.user_id}>
                            {u.name ?? "Unknown"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>}

              {/* Tournament Setup Card - only show in setup status */}
              {arenaState.status === "setup" && (
                isOrganizer ? (
                  <Card className="mb-4">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Tournament Setup</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-3 items-end">
                        <div className="flex-1 min-w-[120px] space-y-1.5">
                          <Label htmlFor="tables" className="text-sm">
                            Tables
                          </Label>
                          <Input
                            id="tables"
                            type="number"
                            placeholder="# of tables"
                            value={tableCountInput}
                            onChange={(e) => setTableCountInput(e.target.value)}
                            className="w-20 h-8 text-sm"
                          />
                        </div>
                        <div className="flex-1 min-w-[120px] space-y-1.5">
                          <Label htmlFor="duration" className="text-sm">
                            Duration (min)
                          </Label>
                          <Input
                            id="duration"
                            type="number"
                            placeholder="Min"
                            value={tournamentDurationInput}
                            onChange={(e) => setTournamentDurationInput(e.target.value)}
                            className="w-20 h-8 text-sm"
                          />
                        </div>
                        {permissions.canStartTournament && (
                          <Button onClick={handleStartTournament} className="w-full h-8 text-sm" size="sm">
                            Start Tournament
                          </Button>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">
                          {arenaState.players.length} players • Need {maxSimultaneousPairings} tables for full pairings
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="mb-4 border-amber-400/30 bg-amber-50/40 dark:bg-amber-950/20">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-5 w-5 animate-spin text-amber-500 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-sm">Waiting for the organizer to start</p>
                          <p className="text-xs text-muted-foreground">
                            {arenaState.players.filter((p) => !p.hasLeft).length} player
                            {arenaState.players.filter((p) => !p.hasLeft).length !== 1 ? "s" : ""} registered so far
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              )}

              {tournamentId && permissions.canAccessQR && (
                <Card className="p-2 bg-primary/5 mb-4">
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0">
                      <div className="bg-white p-1 rounded border border-primary/20">
                        <img
                          src={generateQRCode(`${window.location.origin || "/placeholder.svg"}/join/${tournamentId}`)}
                          alt="QR Code"
                          className="w-14 h-14"
                        />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <QrCode className="h-3.5 w-3.5 flex-shrink-0" />
                        <h3 className="font-semibold text-xs">Player Join Link</h3>
                      </div>
                      <div className="flex gap-1">
                        <Input
                          value={`${window.location.origin}/join/${tournamentId}`}
                          readOnly
                          className="text-[11px] font-mono h-7 flex-1 min-w-0"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 bg-transparent text-xs flex-shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/join/${tournamentId}`)
                            alert("Link copied!")
                          }}
                        >
                          Copy
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        ID: <span className="font-mono font-semibold">{tournamentId}</span>
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    Players ({arenaState.players.filter((p) => !p.hasLeft).length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(!arenaState.isActive || (arenaState.isActive && arenaState.settings.allowLateJoin)) &&
                    arenaState.status !== "completed" && (
                      <div className="space-y-3">
                        {currentUserId && !isOrganizer && !isCurrentUserInTournament && (
                          <Button onClick={joinAsSelf} className="w-full" disabled={joiningSelf}>
                            {joiningSelf ? (
                              <>
                                <MapPin className="mr-2 h-4 w-4" />
                                Verifying location...
                              </>
                            ) : (
                              <>
                                <UserPlus className="mr-2 h-4 w-4" />
                                Join Tournament
                              </>
                            )}
                          </Button>
                        )}

                        {currentUserId && !isOrganizer && isCurrentUserInTournament && (() => {
                          const me = arenaState.players.find((p) => p.userId === currentUserId && !p.hasLeft)
                          const needsCheckIn = me && me.checkedInAt == null
                          return (
                            <div className="space-y-2">
                              {needsCheckIn ? (
                                <Button
                                  onClick={handleCheckIn}
                                  disabled={checkingIn}
                                  variant="default"
                                  className="w-full"
                                >
                                  {checkingIn ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <MapPin className="h-4 w-4 mr-2" />
                                  )}
                                  Check in at venue
                                </Button>
                              ) : (
                                <div className="text-center text-sm text-muted-foreground p-3 border rounded-lg bg-primary/5">
                                  <Check className="inline-block mr-1 h-4 w-4 text-green-500" />
                                  You have joined this tournament
                                </div>
                              )}
                            </div>
                          )
                        })()}

                        {isOrganizer && (
                          <>
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium text-muted-foreground">
                                Search Registered Players
                              </label>
                              <UserSearchAutocomplete onSelectUser={handleSelectUser} />
                            </div>

                            <div className="relative">
                              <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                              </div>
                              <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">Or add guest</span>
                              </div>
                            </div>

                            <Button
                              onClick={handleAddGuestPlayer}
                              variant="outline"
                              className="w-full h-8 text-sm bg-transparent"
                            >
                              Add Guest Player
                            </Button>
                          </>
                        )}

                        {!currentUserId && (
                          <div className="space-y-3">
                            <Button onClick={handleAddGuestPlayer} variant="outline" className="w-full bg-transparent">
                              <UserPlus className="mr-2 h-4 w-4" />
                              Join as Guest
                            </Button>
                            <p className="text-xs text-center text-muted-foreground">
                              <Link href="/auth/login" className="text-primary hover:underline">
                                Login
                              </Link>{" "}
                              or{" "}
                              <Link href="/auth/signup" className="text-primary hover:underline">
                                register
                              </Link>{" "}
                              to track your progress
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                  <PlayersList
                    players={arenaState.players}
                    onRemovePlayer={removePlayer}
                    onTogglePause={isOrganizer ? togglePause : undefined}
                    onMarkPresent={isOrganizer ? handleMarkPresent : undefined}
                    markingPresentPlayerId={markingPresentPlayerId}
                    onRenamePlayer={isOrganizer ? handleRenamePlayer : undefined}
                    renamingPlayerId={renamingPlayerId}
                    status={arenaState.status}
                    isOrganizer={isOrganizer}
                    currentUserId={currentUserId}
                  />
                </CardContent>
              </Card>
            </TabsContent>

          <TabsContent value="pairings">
            {pendingMatches.length > 0 ? (
              <div className="space-y-3">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Current Pairings</CardTitle>
                      <Button variant="outline" size="sm" onClick={() => setIsFullScreenPairings(true)}>
                        <Maximize2 className="h-4 w-4 mr-2" />
                        Full Screen
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid gap-3">
                      {sortedPendingMatches.map((match) => {
                        const p1Sub = match.player1Submission
                        const p2Sub = match.player2Submission
                        const bothSubmitted = p1Sub?.confirmed && p2Sub?.confirmed
                        const hasConflict = bothSubmitted && p1Sub.result !== p2Sub.result
                        const oneSubmitted = (p1Sub?.confirmed || p2Sub?.confirmed) && !bothSubmitted

                        return (
                          <div
                            key={match.id}
                            className={`border-2 rounded-lg hover:bg-accent/50 transition-colors overflow-hidden ${
                              hasConflict ? "border-red-500 bg-red-50/50 dark:bg-red-950/20" :
                              oneSubmitted ? "border-amber-400" : ""
                            }`}
                          >
                            {/* Table number header */}
                            {match.tableNumber && (
                              <div className="bg-amber-700 px-3 py-1 flex items-center gap-2">
                                <span className="text-white font-bold text-sm">Table {match.tableNumber}</span>
                              </div>
                            )}

                            <div className="p-2 space-y-1">
                              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded px-2 py-1">
                                <div className="w-4 h-4 bg-white border-2 border-gray-300 rounded-sm flex-shrink-0" />
                                <span className="font-semibold text-sm break-words">{match.player1.name}</span>
                              </div>
                              <div className="text-center text-xs text-muted-foreground">vs</div>
                              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded px-2 py-1">
                                <div className="w-4 h-4 bg-gray-900 border-2 border-gray-600 rounded-sm flex-shrink-0" />
                                <span className="font-semibold text-sm break-words">{match.player2.name}</span>
                              </div>

                              {hasConflict && (
                                <div className="flex items-center gap-1 px-1 py-0.5 text-red-600 dark:text-red-400 text-xs font-medium">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  Result conflict — check Results tab
                                </div>
                              )}
                              {oneSubmitted && (
                                <div className="flex items-center gap-1 px-1 py-0.5 text-amber-600 dark:text-amber-400 text-xs">
                                  <Clock className="h-3 w-3" />
                                  1 result submitted
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    No active pairings. Waiting for more players to be available.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="results">
            {arenaState.status === "completed" ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    Tournament has ended. No more results can be recorded.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {!effectivePlayerView && arenaState.isActive && showSimulator && (
                  <div className="mb-4">
                    <TournamentSimulatorPanel />
                  </div>
                )}
                {(() => {
                  const normalizedSession =
                    playerSession?.playerId && playerSession?.role
                      ? { playerId: playerSession.playerId, role: playerSession.role as "player" | "organizer" }
                      : undefined
                  const isPlayer = normalizedSession?.role === "player"
                  return isPlayer ? (
                    // Players always see CurrentRound — it shows WaitingRoom when no match is pending
                    <CurrentRound
                      matches={arenaState.pairedMatches}
                      onRecordResult={(id, winner, isDraw) => recordResult(id, winner, isDraw ?? false)}
                      playerSession={normalizedSession}
                      onPlayerSubmit={handlePlayerSubmit}
                      onPlayerConfirm={handlePlayerConfirm}
                      onPlayerCancel={handlePlayerCancel}
                      canRecordResults={permissions.canRecordAnyResult}
                      allPlayers={arenaState.players}
                    />
                  ) : arenaState.pairedMatches.length > 0 ? (
                    <div className="space-y-4">
                      <CurrentRound
                        matches={arenaState.pairedMatches}
                        onRecordResult={(id, winner, isDraw) => recordResult(id, winner, isDraw ?? false)}
                        playerSession={normalizedSession}
                        onPlayerSubmit={handlePlayerSubmit}
                        onPlayerConfirm={handlePlayerConfirm}
                        onPlayerCancel={handlePlayerCancel}
                        canRecordResults={permissions.canRecordAnyResult}
                        allPlayers={arenaState.players}
                      />
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-center text-muted-foreground">No matches yet. Start a tournament to begin.</p>
                      </CardContent>
                    </Card>
                  )
                })()}
              </>
            )}
          </TabsContent>

          <TabsContent value="standings">
            <Leaderboard
              players={arenaState.players}
              effectivePlayerView={effectivePlayerView}
              onOverrideResult={!effectivePlayerView ? overrideResult : undefined}
            />
          </TabsContent>

          {/* Added Settings tab content */}
          {!effectivePlayerView && activeTab === "settings" && (
            <TabsContent value="settings" className="space-y-4">
              <TournamentSettingsPanel
                settings={arenaState.settings}
                onUpdateSettings={handleUpdateSettings}
                onClose={() => {}}
                showSimulator={showSimulator}
                onToggleSimulator={setShowSimulator}
              />

              {arenaState.allTimeMatches.length > 0 && (
                <AlgorithmComparisonPanel
                  tournamentId={tournamentId || ""}
                  players={arenaState.players}
                  matches={arenaState.allTimeMatches}
                  settings={arenaState.settings}
                />
              )}
            </TabsContent>
          )}
        </Tabs>

        <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>End Tournament</DialogTitle>
              <DialogDescription>
                {arenaState.pairedMatches.filter((m) => !m.result?.completed).length > 0
                  ? `There are ${arenaState.pairedMatches.filter((m) => !m.result?.completed).length} active matches. How would you like to proceed?`
                  : "Are you sure you want to end the tournament?"}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-col gap-2">
              <Button variant="destructive" onClick={handleEndImmediately} className="w-full">
                End Immediately (Ignore Active Matches)
              </Button>
              {arenaState.pairedMatches.filter((m) => !m.result?.completed).length > 0 && (
                <Button variant="default" onClick={handleWaitForFinalResults} className="w-full">
                  Wait for Final Results
                </Button>
              )}
              <Button variant="outline" onClick={() => setShowEndDialog(false)} className="w-full">
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {waitingForFinalResults && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-yellow-500 text-black px-4 py-2 rounded-lg shadow-lg">
            Waiting for final results... No new pairings will be created.
          </div>
        )}
      </div>
    </div>
  )
}
