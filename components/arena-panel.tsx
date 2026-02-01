"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card" // Added CardDescription
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CurrentRound } from "./current-round"
import { Leaderboard } from "./leaderboard"
import { TournamentPodium } from "./tournament-podium"
import { TournamentSettingsPanel, type TournamentSettings } from "./tournament-settings" // Import TournamentSettings
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
  savePlayers,
  loadPlayers,
  saveMatches,
  loadMatches,
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

const TOURNAMENT_DURATION = 60 * 60 * 1000 // 1 hour in milliseconds

interface ArenaPanelProps {
  tournamentId: string
  tournamentName: string
  isPlayerView?: boolean // Added prop
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
  // const [isPlayerView, setIsPlayerView] = useState(false) // Moved to props
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
  const [currentPlayerInTournament, setCurrentPlayerInTournament] = useState<Player | null>(null)
  const [userName, setUserName] = useState<string>("") // For logged-in user joining
  const [userRating, setUserRating] = useState<number | null>(null) // For logged-in user joining
  const [userCountry, setUserCountry] = useState<string | null>(null) // For logged-in user joining

  const isOrganizer = currentUserId !== null && currentUserId === organizerId

  const isCurrentUserInTournament = currentUserId
    ? arenaState.players.some((p) => p.userId === currentUserId && !p.isRemoved)
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

  useEffect(() => {
    const loadFromDatabase = async () => {
      if (!tournamentId) return

      console.log("[v0] Loading tournament from database:", tournamentId)

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        const { data: profileData } = await supabase
          .from("users")
          .select("name, rating, country")
          .eq("id", user.id)
          .maybeSingle()
        if (profileData) {
          setUserName(profileData.name || "")
          setUserRating(profileData.rating || null)
          setUserCountry(profileData.country || null)
        }
      }

      const tournament = await loadTournament(tournamentId)
      if (tournament) {
        console.log("[v0] Found tournament:", tournament.name, "Status:", tournament.status)

        setOrganizerId(tournament.organizer_id || null)

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

        setArenaState((prev) => ({
          ...prev,
          players: dbPlayers.length > 0 ? dbPlayers : prev.players,
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
          tournamentStartTime: tournament.start_time || null, // Load start time from DB
        }))
      } else {
        console.log("[v0] Tournament not found, initializing fresh state")
        setArenaState((prev) => ({
          ...prev,
          status: "setup",
        }))
      }

      setIsLoading(false)
    }

    loadFromDatabase()
  }, [tournamentId])

  useEffect(() => {
    if (!tournamentId || isLoading) return

    const saveToDatabase = async () => {
      try {
        const statusToSave = arenaState.status === "completed" ? "completed" : arenaState.isActive ? "active" : "setup"

        await saveTournament(
          tournamentId,
          displayName,
          statusToSave,
          arenaState.tableCount,
          arenaState.settings,
          arenaState.tournamentDuration,
          arenaState.tournamentStartTime, // Save start time
        )
        await savePlayers(tournamentId, arenaState.players)
        console.log("[v0] Tournament auto-saved to database")
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
    arenaState.status, // Added status to dependencies so completed tournaments save correctly
    arenaState.tournamentStartTime, // Added start time to dependencies
    isLoading,
  ])

  useEffect(() => {
    if (!arenaState.isActive || !arenaState.tournamentStartTime) return

    const interval = setInterval(() => {
      const elapsed = Date.now() - arenaState.tournamentStartTime!
      const remaining = Math.max(0, arenaState.tournamentDuration - elapsed)
      setTimeRemaining(remaining)

      console.log("[v0] Timer update:", {
        startTime: new Date(arenaState.tournamentStartTime).toISOString(),
        duration: arenaState.tournamentDuration / 60000,
        elapsed: elapsed / 60000,
        remaining: remaining / 60000,
      })

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
      const availablePlayers = arenaState.players.filter(
        (p) =>
          !p.paused &&
          !p.markedForRemoval &&
          !p.markedForPause && // Added check for markedForPause
          !activePairingMatches.some((m) => m.player1.id === p.id || m.player2.id === p.id),
      )

      const occupiedTables = getOccupiedTables()
      const availableTables = arenaState.tableCount - occupiedTables.length

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
    arenaState.settings, // Use entire settings object
    waitingForFinalResults,
  ])

  useEffect(() => {
    const sessionData = localStorage.getItem("tournamentPlayer")
    console.log("[v0] Checking session data:", sessionData)
    if (sessionData) {
      try {
        const parsed: ArenaSessionData = JSON.parse(sessionData)
        console.log("[v0] Parsed session:", parsed)
        console.log("[v0] Tournament ID match:", parsed.tournamentId, "===", initialTournamentId)
        if (parsed.tournamentId === initialTournamentId && parsed.role === "player") {
          console.log("[v0] Setting player view mode")
          // setIsPlayerView(true) // Removed, now comes from props
          setPlayerSession(parsed)
          // Show welcome message for new players
          const hasSeenWelcome = localStorage.getItem(`welcome_${initialTournamentId}_${parsed.playerId}`)
          if (!hasSeenWelcome && arenaState.isActive) {
            setShowWelcomeMessage(true)
            localStorage.setItem(`welcome_${initialTournamentId}_${parsed.playerId}`, "true")
          }
        } else if (parsed.tournamentId === initialTournamentId && parsed.role === "organizer") {
          console.log("[v0] Setting organizer view mode")
          // setIsPlayerView(false) // Removed, now comes from props
        }
      } catch (err) {
        console.error("[v0] Error parsing session:", err)
        // setIsPlayerView(false) // Removed, now comes from props
      }
    } else {
      console.log("[v0] No session found, defaulting to organizer view")
      // setIsPlayerView(false) // Removed, now comes from props
    }
  }, [initialTournamentId, arenaState.isActive])

  useEffect(() => {
    if (!tournamentId || !arenaState.isActive || activeTab !== "players") return

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
  }, [tournamentId, arenaState.isActive, activeTab])

  useEffect(() => {
    if (!tournamentId || !arenaState.isActive) return

    // Save all active (non-completed) matches
    const activeMatches = arenaState.pairedMatches.filter((m) => !m.result?.completed)
    if (activeMatches.length > 0) {
      saveMatches(tournamentId, activeMatches).catch((err) => console.error("[v0] Failed to save active matches:", err))
    }
  }, [arenaState.pairedMatches.length, tournamentId, arenaState.isActive])

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const addPlayer = async (name: string, userId?: string, isGuest = false) => {
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
      // Added fields from updates
      rating: userRating, // Assuming userRating is available when this is called
      buchholz: 0,
      sonnebornBerger: 0,
      isPaused: false,
      isRemoved: false,
      country: userCountry, // Assuming userCountry is available
    }

    setArenaState((prev) => ({
      ...prev,
      players: [...prev.players, newPlayer],
    }))
    setPlayerNameInput("")

    if (tournamentId) {
      try {
        const supabase = createClient()
        await supabase.from("players").insert({
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
          // Added fields for DB
          rating: newPlayer.rating,
          buchholz: 0,
          sonneborn_berger: 0,
          is_paused: false,
          is_removed: false,
          country: newPlayer.country,
        })
      } catch (error) {
        console.error("[v0] Error saving player to database:", error)
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
    await addPlayer(guestUsername, undefined, true)
  }

  const joinAsSelf = async () => {
    if (!currentUserId || !userName) return

    // Check if user is already in tournament
    if (isCurrentUserInTournament) {
      alert("You are already in this tournament")
      return
    }

    // Check for duplicate name
    const existingPlayer = arenaState.players.find(
      (p) => p.name.toLowerCase() === userName.toLowerCase() && !p.isRemoved,
    )
    if (existingPlayer) {
      alert("A player with this name is already in the tournament")
      return
    }

    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name: userName,
      rating: userRating,
      score: 0,
      buchholz: 0,
      sonnebornBerger: 0,
      isPaused: false,
      isRemoved: false,
      country: userCountry,
      isGuest: false,
      userId: currentUserId,
      // Other fields will be populated by addPlayer if needed, or can be added here
      gamesPlayed: 0,
      streak: 0,
      performance: 0,
      opponentIds: [],
      gameResults: [],
      pieceColors: [],
      active: arenaState.isActive,
      paused: false,
      joinedAt: Date.now(),
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
          buchholz: newPlayer.buchholz,
          sonneborn_berger: newPlayer.sonnebornBerger,
          is_paused: newPlayer.isPaused,
          is_removed: newPlayer.isRemoved,
          country: newPlayer.country,
        })
      } catch (error) {
        console.error("[v0] Error saving player to database:", error)
      }
    }
  }

  const removePlayer = (playerId: string) => {
    console.log("[v0] Attempting to remove player:", playerId)

    // Check if user has permission to remove this player
    const playerToRemove = arenaState.players.find((p) => p.id === playerId)

    if (!playerToRemove) {
      console.log("[v0] Player not found:", playerId)
      return
    }

    console.log("[v0] Player to remove:", playerToRemove.name, "isOrganizer:", isOrganizer)

    // Only organizer can remove others, players can only remove themselves
    if (!isOrganizer) {
      // Check if this is the current player removing themselves
      const isRemovingSelf = currentPlayerInTournament?.id === playerId
      if (!isRemovingSelf) {
        console.log("[v0] Permission denied: only organizer can remove other players")
        return
      }
    }

    if (arenaState.status === "active" && playerToRemove) {
      console.log("[v0] Marking player as removed (tournament active)")
      setArenaState((prev) => ({
        ...prev,
        players: prev.players.map((p) => (p.id === playerId ? { ...p, markedForRemoval: true, paused: true } : p)),
      }))
    } else {
      // During setup, actually remove the player
      console.log("[v0] Removing player from list (tournament setup)")
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
            console.log("[v0] Marking player as paused (removed) in database")
            const { error } = await supabase
              .from("players")
              .update({
                paused: true, // Use paused column to mark as removed
              })
              .eq("id", playerId)
              .eq("tournament_id", tournamentId)

            if (error) {
              console.error("[v0] Failed to mark player as paused in database:", error)
            } else {
              console.log("[v0] Player marked as paused in database successfully")
            }
          } else {
            // Delete player from database during setup
            console.log("[v0] Deleting player from database")
            const { error } = await supabase
              .from("players")
              .delete()
              .eq("id", playerId)
              .eq("tournament_id", tournamentId)

            if (error) {
              console.error("[v0] Failed to delete player from database:", error)
            } else {
              console.log("[v0] Player deleted from database successfully")
            }
          }
        } catch (error) {
          console.error("[v0] Error saving player removal:", error)
        }
      }, 100)
    }
  }

  const startTournament = () => {
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

    setArenaState((prev) => {
      const newTables = tableCount > 0 ? tableCount : Math.floor(arenaState.players.length / 2) // Fixed: Use arenaState.players.length
      return {
        ...prev,
        status: "active",
        isActive: true,
        tableCount: newTables,
        settings: {
          ...prev.settings,
          tableCount: newTables, // Ensure tableCount is synced
        },
        tournamentStartTime: Date.now(),
        tournamentDuration: durationMs,
      }
    })
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
        await saveTournament(tournamentId, displayName, "completed", arenaState.tableCount, arenaState.settings)
        await saveMatches(tournamentId, [], arenaState.allTimeMatches)
        console.log("[v0] Tournament ended and saved as completed")
      } catch (error) {
        console.error("[v0] Error saving tournament end:", error)
      }
    }
  }

  const closePodium = () => {
    setShowPodium(false)
  }

  const recordResult = async (matchId: string, winnerId: string | undefined, isDraw: boolean) => {
    console.log("[v0] Recording result for match:", matchId, "isDraw:", isDraw, "winnerId:", winnerId)

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
          console.log("[v0] All final results entered, ending tournament")
          setTimeout(() => finalizeEndTournament(), 500) // Small delay for state to settle
        }
      }

      newPlayers = newPlayers.map((player) => {
        const hadMatchJustCompleted = updatedMatch.player1.id === player.id || updatedMatch.player2.id === player.id

        if (hadMatchJustCompleted) {
          // Apply marked for removal
          if (player.markedForRemoval) {
            console.log("[v0] Applying deferred removal for:", player.name)
            return { ...player, hasLeft: true, active: false }
          }
          // Apply marked for pause
          if (player.markedForPause) {
            console.log("[v0] Applying deferred pause for:", player.name)
            return { ...player, paused: true, markedForPause: false }
          }
        }
        return player
      })

      if (tournamentId) {
        savePlayers(tournamentId, newPlayers).catch((err) => {
          console.error("[v0] Error saving players after match completion:", err)
        })
        saveMatches(tournamentId, newPairedMatches, newAllTimeMatches).catch((err) => {
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
    console.log("[v0] Recording result for match:", matchId, "isDraw:", isDraw, "winnerId:", winnerId)

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
          console.log("[v0] All final results entered, ending tournament")
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

      if (tournamentId) {
        savePlayers(tournamentId, playersAfterRemoval).catch((err) => {
          console.error("[v0] Error saving players after result:", err)
        })
        saveMatches(tournamentId, updatedPairedMatches, newAllTimeMatches).catch((err) => {
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

    console.log("[v0] REMATCH ANALYSIS:", {
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

    if (!player.paused && !arenaState.settings.allowSelfPause) {
      alert("Self-pause is not allowed in this tournament.")
      return
    }

    if (!player.paused && player.gamesPlayed < arenaState.settings.minGamesBeforePause) {
      alert(`Players must complete at least ${arenaState.settings.minGamesBeforePause} games before pausing.`)
      return
    }

    const isCurrentlyPaired = arenaState.pairedMatches.some(
      (m) => !m.result?.completed && (m.player1.id === playerId || m.player2.id === playerId),
    )

    if (!player.paused && isCurrentlyPaired) {
      // Mark for pause instead of immediate pause
      setArenaState((prev) => ({
        ...prev,
        players: prev.players.map((p) => (p.id === playerId ? { ...p, markedForPause: !p.markedForPause } : p)),
      }))
    } else {
      // Toggle pause/unpause immediately if not paired or already paused
      setArenaState((prev) => ({
        ...prev,
        players: prev.players.map((p) => (p.id === playerId ? { ...p, paused: !p.paused, markedForPause: false } : p)),
      }))
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
    console.log("[v0] Player submitting result:", matchId, result)
    if (!playerSession) {
      console.log("[v0] No player session, rejecting submission")
      return
    }

    const match = arenaState.pairedMatches.find((m) => m.id === matchId)
    if (!match) {
      console.log("[v0] Match not found, rejecting submission")
      return
    }

    const isPlayerInMatch = match.player1.id === playerSession.playerId || match.player2.id === playerSession.playerId
    if (!isPlayerInMatch) {
      console.log("[v0] Player not in match, rejecting submission")
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
    console.log("[v0] Player confirming result:", matchId)
    if (!playerSession) return

    const match = arenaState.pairedMatches.find((m) => m.id === matchId)
    if (!match) return

    const isPlayerInMatch = match.player1.id === playerSession.playerId || match.player2.id === playerSession.playerId
    if (!isPlayerInMatch) {
      console.log("[v0] Player not in match, rejecting confirmation")
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
      const response = await submitMatchResult(matchId, submission.result, true)

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

      const updatedMatch = response.match

      if (updatedMatch) {
        console.log("[v0] Match submission saved:", updatedMatch)

        // Check if both players submitted matching results
        if (
          updatedMatch.player1_submission &&
          updatedMatch.player2_submission &&
          updatedMatch.player1_submission === updatedMatch.player2_submission
        ) {
          // Auto-confirm the match with the agreed result
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
    console.log("[v0] Player canceling submission:", matchId)
    // Remove temporary submission
    setPlayerSubmissions((prev) => {
      const updated = { ...prev }
      delete updated[matchId]
      return updated
    })
  }

  const overrideResult = async (playerId: string, gameIndex: number, newResult: "W" | "D" | "L") => {
    console.log("[v0] Overriding result for player:", playerId, "game:", gameIndex, "new result:", newResult)

    setArenaState((prev) => {
      const player = prev.players.find((p) => p.id === playerId)
      if (!player || gameIndex >= player.gameResults.length) {
        console.error("[v0] Invalid player or game index")
        return prev
      }

      const oldResult = player.gameResults[gameIndex]
      if (oldResult === newResult) {
        console.log("[v0] Result unchanged, no update needed")
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

      // Save updated player and match states
      if (tournamentId) {
        savePlayers(tournamentId, updated.players).catch((err) => {
          console.error("[v0] Error saving players after match completion:", err)
        })
        saveMatches(tournamentId, updated.pairedMatches, updated.allTimeMatches).catch((err) => {
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

        {showWelcomeMessage && isPlayerView && (
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Consolidate header elements */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold">{displayName}</h1>
                <Link href="/">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Home className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              {organizerName && (
                <p className="text-sm text-muted-foreground">
                  Organized by <span className="font-semibold">{organizerName}</span>
                  {isOrganizer && <span className="text-primary ml-1">(You)</span>}
                </p>
              )}
              {arenaState.status === "completed" && (
                <p className="text-sm text-muted-foreground mt-1">Tournament Completed</p>
              )}
            </div>

            <TabsList className="grid grid-cols-4 h-auto">
              {!isPlayerView && (
                <TabsTrigger value="players" className="text-xs sm:text-sm h-10 px-3">
                  <Users className="h-4 w-4 mr-1" />
                  Players
                </TabsTrigger>
              )}
              <TabsTrigger value="pairings" className="text-xs sm:text-sm h-10 px-3">
                <Swords className="h-4 w-4 mr-1" />
                Pairings
              </TabsTrigger>
              {arenaState.status !== "completed" && (
                <TabsTrigger value="results" className="text-xs sm:text-sm h-10 px-3">
                  <Trophy className="h-4 w-4 mr-1" />
                  Results
                </TabsTrigger>
              )}
              <TabsTrigger value="standings" className="text-xs sm:text-sm h-10 px-3">
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

          {!isPlayerView && (
            <TabsContent value="players" className="space-y-2">
              {/* Tournament Setup Card - only show in setup status */}
              {arenaState.status === "setup" && (
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
                          disabled={!isOrganizer}
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
                          disabled={!isOrganizer}
                        />
                      </div>
              {permissions.canStartTournament && (
                <Button onClick={startTournament} className="w-full h-8 text-sm" size="sm">
                  Start Tournament
                </Button>
              )}
                      {!isOrganizer && (
                        <p className="text-xs text-muted-foreground text-center py-2 flex-1">
                          Waiting for organizer to start the tournament
                        </p>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        {arenaState.players.length} players • Need {maxSimultaneousPairings} tables for full pairings
                      </p>
                    </div>
                  </CardContent>
                </Card>
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
                    Players ({arenaState.players.filter((p) => !p.isRemoved).length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(!arenaState.isActive || (arenaState.isActive && arenaState.settings.allowLateJoin)) &&
                    arenaState.status !== "completed" && (
                      <div className="space-y-3">
                        {currentUserId && !isOrganizer && !isCurrentUserInTournament && (
                          <Button onClick={joinAsSelf} className="w-full">
                            <UserPlus className="mr-2 h-4 w-4" />
                            Join Tournament
                          </Button>
                        )}

                        {currentUserId && !isOrganizer && isCurrentUserInTournament && (
                          <div className="text-center text-sm text-muted-foreground p-3 border rounded-lg bg-primary/5">
                            <Check className="inline-block mr-1 h-4 w-4 text-green-500" />
                            You have joined this tournament
                          </div>
                        )}

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
                    status={arenaState.status}
                    isOrganizer={isOrganizer}
                    currentUserId={currentUserId}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          )}

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
                      {sortedPendingMatches.map((match) => (
                        <div
                          key={match.id}
                          className="border-2 rounded-lg hover:bg-accent/50 transition-colors overflow-hidden"
                        >
                          {/* Table number header */}
                          {match.tableNumber && (
                            <div className="bg-amber-700 px-3 py-1 flex items-center gap-2">
                              <span className="text-white font-bold text-sm">Table {match.tableNumber}</span>
                            </div>
                          )}

                          {/* Players - stacked vertically for full name visibility */}
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
            ) : !isPlayerView && arenaState.isActive && showSimulator ? (
              <div className="mb-4">
                <TournamentSimulatorPanel />
              </div>
            ) : null}
            {arenaState.status !== "completed" && arenaState.pairedMatches.length > 0 ? (
              <div className="space-y-4">
                <CurrentRound
                  matches={arenaState.pairedMatches}
                  onRecordResult={recordResult}
                  playerSession={playerSession}
                  playerSubmissions={playerSubmissions}
                  onPlayerSubmit={handlePlayerSubmit}
                  onPlayerConfirm={handlePlayerConfirm}
                  onPlayerCancel={handlePlayerCancel}
                  canRecordResults={permissions.canRecordAnyResult}
                />
              </div>
            ) : (
              arenaState.status !== "completed" && (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">No matches yet. Start a tournament to begin.</p>
                  </CardContent>
                </Card>
              )
            )}
          </TabsContent>

          <TabsContent value="standings">
            <Leaderboard
              players={arenaState.players}
              isPlayerView={isPlayerView}
              onOverrideResult={!isPlayerView ? overrideResult : undefined}
            />
          </TabsContent>

          {/* Added Settings tab content */}
          {!isPlayerView && activeTab === "settings" && (
            <TabsContent value="settings" className="space-y-4">
              <TournamentSettingsPanel
                settings={arenaState.settings}
                onUpdateSettings={handleUpdateSettings}
                onClose={() => {}}
                showSimulator={showSimulator}
                onToggleSimulator={setShowSimulator}
              />

              {console.log("[v0] Comparison panel check:", {
                allTimeMatchesLength: arenaState.allTimeMatches.length,
                shouldShow: arenaState.allTimeMatches.length > 0,
              })}

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
