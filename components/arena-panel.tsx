"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card" // Added CardDescription
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Leaderboard } from "./leaderboard"
import { TournamentPodium } from "./tournament-podium"
import { TournamentSettingsPanel } from "./tournament-settings"
import { AlgorithmComparisonPanel } from "./algorithm-comparison-panel"
import type { ArenaState, Player, Match, MatchResult, TournamentSettings } from "@/lib/types"
import { getPairingAlgorithm } from "@/lib/pairing"
import { calculatePointsFromSettings } from "@/lib/points"
import { logArenaPairing } from "@/lib/pairing/arena-pairing-debug"
import { isPlayerAvailableForPairing } from "@/lib/pairing/player-eligibility"
import { isArenaT1Eligible, setArenaCooldownReductions } from "@/lib/pairing/arena-t1"
import {
  X,
  Trophy,
  Loader2,
  Trash2,
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
import { parseTournamentSettings } from "@/lib/tournament-settings"
import {
  effectiveTableCountFromDb,
  effectiveTableSlotsForPairing,
} from "@/lib/tournament/effective-table-count"
import {
  saveTournament,
  loadTournament,
  loadPlayers,
  savePlayers,
  saveMatches,
  loadMatches,
  playerNameExistsInTournament,
  getAvatarUrls,
  formatSupabaseError,
} from "@/lib/database/tournament-db"
import { useRouter } from "next/navigation"
import { ArenaPlayersTab } from "@/components/tournament/arena-players-tab"
import { ArenaPairingsTab } from "@/components/tournament/arena-pairings-tab"
import { ArenaPairingStatusPanel } from "@/components/tournament/arena-pairing-status-panel"
import { ArenaResultsTab } from "@/components/tournament/arena-results-tab"
import { ArenaTournamentHeader } from "@/components/tournament/arena-tournament-header"
import { PairingMatchCard } from "@/components/tournament/pairing-match-card"
import { createClient } from "@/lib/supabase/client" // Import createClient for Supabase
import { generateGuestUsername } from "@/lib/guest-names" // Import memorable guest name generator
import {
  addGuestSession,
  getGuestSessionHistory,
  getConversionPromptDismissed,
  type GuestSessionEntry,
} from "@/lib/guest-session-history"
import { ConversionPrompt, type ConversionTrigger } from "@/components/conversion-prompt"
import { cn } from "@/lib/utils"
import { verifyAndCheckIn, markPresentOverride, checkVenueProximity } from "@/app/actions/check-in"
import { renamePlayer } from "@/app/actions/rename-player"
import { deleteTournament } from "@/app/actions/delete-tournament"
import { resolveRating, type RatingBandValue } from "@/lib/rating-bands"
import { toast } from "sonner"
import { useI18n } from "@/components/i18n-provider"
import { useRealtime } from "@/hooks/tournament/use-realtime"
import { getDeviceId } from "@/lib/device-id"
import { messageForSubmitResponse } from "@/lib/submit-client-message"

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

function assignTablesToMatchesForState(matches: Match[], state: ArenaState): Match[] {
  const sortedMatches = [...matches].sort((a, b) => {
    const scoreA = a.player1.score + a.player2.score
    const scoreB = b.player1.score + b.player2.score
    return scoreB - scoreA
  })
  const slots = effectiveTableSlotsForPairing(state.tableCount, state.settings)
  const occupiedTables = state.pairedMatches
    .filter((m) => !m.result?.completed && m.tableNumber)
    .map((m) => m.tableNumber!)
  const availableTables = Array.from({ length: slots }, (_, i) => i + 1).filter(
    (t) => !occupiedTables.includes(t),
  )
  return sortedMatches.map((match, index) => ({
    ...match,
    tableNumber: availableTables[index],
  }))
}

export function ArenaPanel({ tournamentId: initialTournamentId, tournamentName, isPlayerView }: ArenaPanelProps) {
  const router = useRouter()
  const { t } = useI18n()
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
  const [displayName, setDisplayName] = useState(tournamentName || t("arena.defaultTournamentName"))

  useEffect(() => {
    if (tournamentName?.trim()) setDisplayName(tournamentName.trim())
  }, [tournamentName])
  const [playerNameInput, setPlayerNameInput] = useState("") // Renamed to playerNameInput
  const [tableCountInput, setTableCountInput] = useState("")
  const [tournamentDurationInput, setTournamentDurationInput] = useState("60") // Default 60 minutes
  const [timeRemaining, setTimeRemaining] = useState(TOURNAMENT_DURATION)
  const [completionRatio, setCompletionRatio] = useState(0)
  const hasShownAllPairingsCompleteToast = useRef(false)
  const [showPodium, setShowPodium] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingTournament, setDeletingTournament] = useState(false)
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

  const [checkingIn, setCheckingIn] = useState(false)
  const [markingPresentPlayerId, setMarkingPresentPlayerId] = useState<string | null>(null)
  const [renamingPlayerId, setRenamingPlayerId] = useState<string | null>(null)
  const [joiningSelf, setJoiningSelf] = useState(false)
  const [pastGuestSessions, setPastGuestSessions] = useState<GuestSessionEntry[]>([])
  const [showConversionPrompt, setShowConversionPrompt] = useState<ConversionTrigger | null>(null)

  const isOrganizer = currentUserId !== null && currentUserId === organizerId

  // All vs All: compute unique pairings completion ratio for organizer display
  // Use allTimeMatches (completed from DB/load) + completed in pairedMatches so ratio survives reload/realtime
  useEffect(() => {
    if (
      arenaState.settings.pairingAlgorithm !== "all-vs-all" ||
      !arenaState.isActive ||
      arenaState.players.length < 2
    ) {
      setCompletionRatio(0)
      return
    }
    const completedFromPaired = arenaState.pairedMatches.filter((m) => m.result?.completed)
    const allCompleted = [...arenaState.allTimeMatches, ...completedFromPaired]
    const uniquePairings = new Set(
      allCompleted.map((m) => {
        const sorted = [m.player1.id, m.player2.id].sort()
        return `${sorted[0]}-${sorted[1]}`
      }),
    )
    const n = arenaState.players.filter((p) => !p.hasLeft).length
    const maxPossible = (n * (n - 1)) / 2
    const ratio = maxPossible > 0 ? uniquePairings.size / maxPossible : 0
    setCompletionRatio(ratio)
    if (ratio >= 1 && isOrganizer && !hasShownAllPairingsCompleteToast.current) {
      hasShownAllPairingsCompleteToast.current = true
      toast.success(t("arena.allUniquePairingsCompleteMessage"))
    }
  }, [
    arenaState.settings.pairingAlgorithm,
    arenaState.isActive,
    arenaState.players,
    arenaState.pairedMatches,
    arenaState.allTimeMatches,
    isOrganizer,
    t,
  ])

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

      toast.success(t("arena.toastYouHaveBeenPaired"), {
        description: `vs ${opponentName}${tableLabel}`,
        duration: 8000,
      })

      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification(t("arena.toastYouHaveBeenPaired"), {
          body: `vs ${opponentName}${tableLabel} — tap to open`,
          icon: "/icon-192.png",
        })
      }

      setHasNewPairing(true)
    },
    [playerSession?.playerId, t],
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
      recordResult(matchId, winnerId, isDraw, /* skipDbWrite */ true)
    } : undefined,
  })

  useEffect(() => {
    if (activeTab === "pairingStatus" && (!isOrganizer || !arenaState.isActive)) {
      setActiveTab("pairings")
    }
  }, [activeTab, isOrganizer, arenaState.isActive])

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

        if (tournament.name?.trim()) {
          setDisplayName(tournament.name.trim())
        }

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

        const validatedSettings = parseTournamentSettings(tournament)
        const resolvedTables = effectiveTableCountFromDb({
          tables_count: tournament.tables_count,
          settings: validatedSettings,
          status: tournament.status,
        })

        setArenaState((prev) => ({
          ...prev,
          players: enrichedPlayers.length > 0 ? enrichedPlayers : prev.players,
          tableCount: resolvedTables,
          settings: {
            ...validatedSettings,
            tableCount: resolvedTables,
          },
          status: tournament.status,
          isActive: tournament.status === "active",
          pairedMatches: activeMatches,
          allTimeMatches: completedMatches,
          tournamentDuration: TOURNAMENT_DURATION,
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
    suppressRealtime,
  ])

  useEffect(() => {
    if (!arenaState.isActive || !arenaState.tournamentStartTime) return

    const interval = setInterval(() => {
      const elapsed = Date.now() - arenaState.tournamentStartTime!
      const remaining = Math.max(0, arenaState.tournamentDuration - elapsed)
      setTimeRemaining(remaining)

      // Timer update - too chatty for normal logging

      // Only organizer can open the end-tournament dialog; players get status via Realtime when organizer concludes
      if (remaining === 0 && !waitingForFinalResults && isOrganizer) {
        endTournament()
      }
    }, 1000)

    // Calculate initial time remaining on mount
    const elapsed = Date.now() - arenaState.tournamentStartTime
    const remaining = Math.max(0, arenaState.tournamentDuration - elapsed)
    setTimeRemaining(remaining)

    return () => clearInterval(interval)
  }, [arenaState.isActive, arenaState.tournamentStartTime, arenaState.tournamentDuration, waitingForFinalResults, isOrganizer])

  const arenaStateRef = useRef(arenaState)
  arenaStateRef.current = arenaState
  const cooldownReductionMsByPlayerIdRef = useRef<Record<string, number>>({})
  const waitingForFinalResultsRef = useRef(waitingForFinalResults)
  waitingForFinalResultsRef.current = waitingForFinalResults
  useEffect(() => {
    setArenaCooldownReductions(cooldownReductionMsByPlayerIdRef.current)
    return () => setArenaCooldownReductions({})
  }, [])

  useEffect(() => {
    if (!arenaState.isActive) {
      cooldownReductionMsByPlayerIdRef.current = {}
      setArenaCooldownReductions({})
    }
  }, [arenaState.isActive])

  const tournamentMetadataForPairingRef = useRef(tournamentMetadata)
  tournamentMetadataForPairingRef.current = tournamentMetadata

  /* Pairing uses refs so each tick sees latest players (pieceColors, scores) without stale closures. */
  useEffect(() => {
    if (!arenaState.isActive || waitingForFinalResults) return

    const algorithmId = arenaState.settings.pairingAlgorithm || "all-vs-all"
    const algorithm = getPairingAlgorithm(algorithmId)

    const pairingTimer = setInterval(() => {
      const state = arenaStateRef.current
      if (!state.isActive || waitingForFinalResultsRef.current) return

      const activePairingMatches = state.pairedMatches.filter((m) => !m.result?.completed)
      const meta = tournamentMetadataForPairingRef.current
      const hasVenue = meta?.latitude != null && meta?.longitude != null
      const availablePlayers = state.players.filter((p) =>
        isPlayerAvailableForPairing(p, activePairingMatches, hasVenue),
      )

      const tableSlots = effectiveTableSlotsForPairing(state.tableCount, state.settings)
      const occupiedTables = state.pairedMatches
        .filter((m) => !m.result?.completed && m.tableNumber)
        .map((m) => m.tableNumber!)
      const availableTables = tableSlots - occupiedTables.length

      const matchesForPairing = (() => {
        const byId = new Map<string, Match>()
        for (const m of state.allTimeMatches) byId.set(m.id, m)
        for (const m of state.pairedMatches) {
          if (m.result?.completed) byId.set(m.id, m)
        }
        return [...byId.values()]
      })()

      if (DEBUG)
        console.log(`[v0] ${algorithm.name}: Pairing check`, {
          algorithm: algorithm.id,
          totalPlayers: state.players.length,
          availablePlayers: availablePlayers.length,
          activeMatches: activePairingMatches.length,
          totalTables: tableSlots,
          availableTables,
          historyMatchesForPairing: matchesForPairing.length,
        })

      const wouldPair = algorithm.shouldPair(
        availablePlayers,
        activePairingMatches,
        state.players.length,
        availableTables,
        state.settings,
        matchesForPairing,
      )

      if (!wouldPair) {
        return
      }

      const maxMatches = Math.min(availableTables, Math.floor(availablePlayers.length / 2))

      const newMatches = algorithm.createPairings(
        availablePlayers,
        matchesForPairing,
        state.settings,
        maxMatches,
        state.players.length,
      )

      if (newMatches.length > 0) {
        const matchesWithTables = assignTablesToMatchesForState(newMatches, state)
        if (DEBUG)
          console.log(
            `[v0] ${algorithm.name}: Creating new matches:`,
            matchesWithTables.map((m) => `${m.player1.name} vs ${m.player2.name} (Table ${m.tableNumber})`),
          )

        // H3: clear cooldown reductions for players who are now paired into a new match
        for (const m of matchesWithTables) {
          delete cooldownReductionMsByPlayerIdRef.current[m.player1.id]
          delete cooldownReductionMsByPlayerIdRef.current[m.player2.id]
        }
        setArenaCooldownReductions(cooldownReductionMsByPlayerIdRef.current)

        // C2 guard: verify no proposed player is already in an active DB match
        // (prevents two organizer tabs from creating duplicate pairings)
        if (tournamentId) {
          const proposedPlayerIds = new Set(
            matchesWithTables.flatMap((m) => [m.player1.id, m.player2.id]),
          )
          loadMatches(tournamentId).then((dbMatches) => {
            const dbActivePlayerIds = new Set(
              dbMatches
                .filter((m) => !m.result?.completed)
                .flatMap((m) => [m.player1.id, m.player2.id]),
            )
            const conflictFree = matchesWithTables.filter(
              (m) => !dbActivePlayerIds.has(m.player1.id) && !dbActivePlayerIds.has(m.player2.id),
            )
            if (conflictFree.length < matchesWithTables.length && DEBUG) {
              console.warn(`[v0] Pairing dedup: dropped ${matchesWithTables.length - conflictFree.length} matches (players already in active DB matches)`)
            }
            if (conflictFree.length > 0) {
              setArenaState((prev) => ({
                ...prev,
                pairedMatches: [...prev.pairedMatches, ...conflictFree],
              }))
            }
          }).catch((err) => {
            console.error("[v0] Pairing dedup check failed, saving all matches:", formatSupabaseError(err))
            setArenaState((prev) => ({
              ...prev,
              pairedMatches: [...prev.pairedMatches, ...matchesWithTables],
            }))
          })
        } else {
          setArenaState((prev) => ({
            ...prev,
            pairedMatches: [...prev.pairedMatches, ...matchesWithTables],
          }))
        }
      }
    }, algorithm.getPollingInterval())

    return () => clearInterval(pairingTimer)
  }, [
    arenaState.isActive,
    arenaState.settings.pairingAlgorithm,
    waitingForFinalResults,
    tournamentMetadata?.latitude,
    tournamentMetadata?.longitude,
  ])

  const collectPairingInputs = useCallback((state: ArenaState) => {
    const activePairingMatches = state.pairedMatches.filter((m) => !m.result?.completed)
    const hasVenue = tournamentMetadata?.latitude != null && tournamentMetadata?.longitude != null
    const availablePlayers = state.players.filter((p) =>
      isPlayerAvailableForPairing(p, activePairingMatches, hasVenue),
    )
    const tableSlots = effectiveTableSlotsForPairing(state.tableCount, state.settings)
    const occupiedTables = state.pairedMatches
      .filter((m) => !m.result?.completed && m.tableNumber)
      .map((m) => m.tableNumber!)
    const availableTables = tableSlots - occupiedTables.length
    const matchesForPairing = (() => {
      const byId = new Map<string, Match>()
      for (const m of state.allTimeMatches) byId.set(m.id, m)
      for (const m of state.pairedMatches) {
        if (m.result?.completed) byId.set(m.id, m)
      }
      return [...byId.values()]
    })()
    return { activePairingMatches, availablePlayers, availableTables, matchesForPairing }
  }, [tournamentMetadata?.latitude, tournamentMetadata?.longitude])

  const handleReduceWaitOneMinute = useCallback(() => {
    if (!isOrganizer || !arenaState.isActive || waitingForFinalResults) return
    if ((arenaState.settings.pairingAlgorithm || "all-vs-all") !== "balanced-strength") return

    const state = arenaStateRef.current
    const { availablePlayers, matchesForPairing } = collectPairingInputs(state)
    const now = Date.now()
    const coolingPlayers = availablePlayers.filter(
      (p) => !isArenaT1Eligible(p, matchesForPairing, state.settings, now),
    )

    if (coolingPlayers.length === 0) {
      toast.message(t("arena.reduceWaitNoPlayers"))
      return
    }

    const reductionStepMs = 60_000
    const next = { ...cooldownReductionMsByPlayerIdRef.current }
    for (const p of coolingPlayers) {
      next[p.id] = (next[p.id] ?? 0) + reductionStepMs
    }
    cooldownReductionMsByPlayerIdRef.current = next
    setArenaCooldownReductions(next)

    logArenaPairing("Reduced cooldown by 60s", {
      affectedCount: coolingPlayers.length,
      affectedPlayers: coolingPlayers.map((p) => p.name),
    })
    toast.success(t("arena.reduceWaitSuccess", { count: coolingPlayers.length }))
  }, [
    arenaState.isActive,
    arenaState.settings.pairingAlgorithm,
    collectPairingInputs,
    isOrganizer,
    t,
    waitingForFinalResults,
  ])

  // When organizer is in "wait for final results" and all matches are complete (e.g. via Realtime),
  // persist tournament as completed so players see the correct status.
  useEffect(() => {
    if (
      !tournamentId ||
      !isOrganizer ||
      !waitingForFinalResults ||
      arenaState.status === "completed" ||
      arenaState.pairedMatches.length === 0
    )
      return
    const allComplete = arenaState.pairedMatches.every((m) => m.result?.completed)
    if (!allComplete) return
    const timerId = setTimeout(() => finalizeEndTournament(), 600)
    return () => clearTimeout(timerId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finalizeEndTournament identity changes each render
  }, [
    tournamentId,
    isOrganizer,
    waitingForFinalResults,
    arenaState.status,
    arenaState.pairedMatches,
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

    // One-time refresh when switching to Players tab
    refreshPlayers()

    // Only poll every 5s if Realtime is not yet active (still loading)
    if (isLoading) {
      const interval = setInterval(refreshPlayers, 5000)
      return () => clearInterval(interval)
    }
  }, [tournamentId, arenaState.status, activeTab, isLoading])

  useEffect(() => {
    if (!tournamentId || !arenaState.isActive || !isOrganizer) return

    // Save all active (non-completed) matches
    const activeMatches = arenaState.pairedMatches.filter((m) => !m.result?.completed)
    if (activeMatches.length > 0) {
      suppressRealtime()
      saveMatches(tournamentId, activeMatches).catch((err) => console.error("[v0] Failed to save active matches:", formatSupabaseError(err)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- length-only dep: avoid save spam; body reads latest pairedMatches
  }, [
    arenaState.pairedMatches.length,
    tournamentId,
    arenaState.isActive,
    isOrganizer,
    suppressRealtime,
  ])

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
      toast.error(t("arena.alertPlayerAlreadyInTournament"))
      return
    }

    if (arenaState.isActive && !arenaState.settings.allowLateJoin) {
      toast.error(t("arena.alertLateJoinsNotAllowed"))
      return
    }

    if (arenaState.isActive) {
      const newTotalPlayers = arenaState.players.length + 1
      const maxSimultaneousPairings = Math.floor(newTotalPlayers / 2)

      if (maxSimultaneousPairings > arenaState.tableCount) {
        toast.error(t("arena.alertCannotAddPlayerTables", { max: maxSimultaneousPairings, tables: arenaState.tableCount }))
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
      rating: resolveRating(userRating, userRatingBand as RatingBandValue | null | undefined),
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
          device_id: deviceId,
        })
        if (insertErr) {
          const err = insertErr as unknown as Record<string, unknown>
          const msg = (err.message as string) ?? (insertErr instanceof Error ? insertErr.message : String(insertErr))
          const code = (err.code as string) ?? ""
          const details = (err.details as string) ?? ""
          const hint = (err.hint as string) ?? ""
          if (code === "23505") {
            toast.error(t("arena.toastAlreadyJoinedFromDevice"))
            setArenaState((prev) => ({
              ...prev,
              players: prev.players.filter((p) => p.id !== newPlayer.id),
            }))
            return
          }
          console.error("[v0] Error saving player to database:", msg, code ? `(${code})` : "", details || hint || "")
          toast.error(msg || t("arena.toastFailedToAddPlayer"))
        }
      } catch (error) {
        const err = error as Record<string, unknown>
        const msg = (err?.message as string) ?? (error instanceof Error ? error.message : String(error))
        console.error("[v0] Error saving player to database:", msg, error)
        toast.error(msg || t("arena.toastFailedToAddPlayer"))
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

  const handleCheckIn = async () => {
    if (!tournamentId) return
    setCheckingIn(true)
    const tryCheckIn = (): Promise<boolean> =>
      new Promise((resolve) => {
        if (!navigator.geolocation) {
          toast.error(t("arena.toastLocationNotAvailable"))
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
            toast.success(t("arena.toastYouAreCheckedIn"))
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
      toast.info(t("arena.toastRetryingInSeconds"))
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
      toast.success(t("arena.toastPlayerMarkedPresent"))
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
      toast.success(t("arena.toastPlayerRenamed"))
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
      toast.error(t("arena.toastTournamentEndedNoJoin"))
      return
    }

    if (arenaState.isActive && !arenaState.settings.allowLateJoin) {
      toast.error(t("arena.alertLateJoinsNotAllowed"))
      return
    }

    if (arenaState.isActive) {
      const newTotalPlayers = arenaState.players.filter((p) => !p.hasLeft).length + 1
      const maxPairings = Math.floor(newTotalPlayers / 2)
      if (maxPairings > arenaState.tableCount) {
        toast.error(t("arena.toastTablesFull", { count: arenaState.tableCount }))
        return
      }
    }

    if (isCurrentUserInTournament) {
      toast.error(t("arena.toastAlreadyInTournament"))
      return
    }

    const existingPlayer = arenaState.players.find(
      (p) => p.name.toLowerCase() === userName.toLowerCase() && !p.hasLeft,
    )
    if (existingPlayer) {
      toast.error(t("arena.toastPlayerNameAlreadyInTournament"))
      return
    }

    const nameTaken = tournamentId ? await playerNameExistsInTournament(tournamentId, userName) : false
    if (nameTaken) {
      toast.error(t("arena.toastNameExistsTryDifferent", { name: userName }))
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
            toast.info(t("arena.toastLocationUnavailableStillJoin"))
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
                toast.info(t("arena.toastNotAtVenueYet"))
                resolve({ checkedInAt: null, presenceSource: null })
                return
              }
              resolve({ checkedInAt: Date.now(), presenceSource: "gps" })
            },
            () => {
              toast.info(t("arena.toastLocationUnavailableStillJoin"))
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
      rating: resolveRating(userRating, userRatingBand as RatingBandValue | null | undefined),
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
      toast.error(t("arena.alertTournamentAlreadyCompleted"))
      return
    }

    if (arenaState.players.length < 2) {
      toast.error(t("arena.alertNeedAtLeastTwoPlayers"))
      return
    }

    const tableCount = Number.parseInt(tableCountInput)
    if (!tableCount || tableCount < 1) {
      toast.error(t("arena.alertInvalidTableCount"))
      return
    }

    const maxSimultaneousPairings = Math.floor(arenaState.players.length / 2)
    if (tableCount < maxSimultaneousPairings) {
      toast.error(t("arena.alertNotEnoughTables", { players: arenaState.players.length, tables: maxSimultaneousPairings }))
      return
    }

    const durationMinutes = Number.parseInt(tournamentDurationInput)
    if (!durationMinutes || durationMinutes < 1) {
      toast.error(t("arena.alertInvalidDurationMinutes"))
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
        toast.error(result.error || t("arena.alertStartTournamentFailed"))
        return
      }
    } catch (error) {
      console.error("[v0] Error calling startTournament action:", error)
      toast.error(t("arena.alertStartTournamentFailed"))
      return
    }

    const newTables = tableCount > 0 ? tableCount : Math.floor(arenaState.players.length / 2)
    const startTimeMs = Date.now()

    try {
      suppressRealtime?.()
      await saveTournament(
        tournamentId,
        displayName,
        "active",
        newTables,
        {
          ...arenaState.settings,
          tableCount: newTables,
        },
        tournamentMetadata?.city,
        tournamentMetadata?.country,
        organizerId ?? currentUserId ?? undefined,
        tournamentMetadata?.latitude,
        tournamentMetadata?.longitude,
        tournamentMetadata?.visibility ?? "public",
        new Date(startTimeMs).toISOString(),
      )
    } catch (err) {
      console.error("[v0] Failed to persist tables_count after start:", formatSupabaseError(err))
    }

    setArenaState((prev) => ({
      ...prev,
      status: "active",
      isActive: true,
      tableCount: newTables,
      settings: {
        ...prev.settings,
        tableCount: newTables,
      },
      tournamentStartTime: startTimeMs,
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
        suppressRealtime?.() // avoid Realtime echo overwriting local state on organizer's client
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

  const recordResult = async (matchId: string, winnerId: string | undefined, isDraw: boolean, skipDbWrite = false) => {
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
        endTime: Date.now(),
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
          pointsEarned: [...(player.pointsEarned || []), points],
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

        // Only organizer persists completion; players will see status via Realtime once organizer finalizes
        if (remainingMatches.length === 0 && isOrganizer) {
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

      if (tournamentId && isOrganizer && !skipDbWrite) {
        savePlayers(tournamentId, newPlayers).catch((err) => {
          console.error("[v0] Error saving players after match completion:", formatSupabaseError(err))
        })
        saveMatches(tournamentId, mergeMatchesForSave(newPairedMatches, newAllTimeMatches)).catch((err) => {
          console.error("[v0] Error saving matches after match completion:", formatSupabaseError(err))
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

    const rematchDetail =
      rematches.length > 0
        ? rematches.map((r) => `${r.players}: ${r.count} times`).join("\n")
        : "No rematches detected!"
    toast.info(t("arena.rematchAnalysisTitle"), {
      description: `Unique pairings: ${uniquePairings.size}\nRematches: ${rematches.length}\n\n${rematchDetail}`,
      duration: 20_000,
    })

    return rematches
  }

  const togglePause = (playerId: string) => {
    const player = arenaState.players.find((p) => p.id === playerId)
    if (!player) return

    if (
      !player.paused &&
      !player.markedForPause &&
      !confirm(t("arena.confirmPausePlayer", { name: player.name }))
    ) {
      return
    }

    const isSelfPause = !isOrganizer && (playerId === currentPlayerInTournament?.id || playerId === playerSession?.playerId)

    if (!player.paused && isSelfPause && !arenaState.settings.allowSelfPause) {
      toast.error(t("arena.alertSelfPauseNotAllowed"))
      return
    }

    if (!player.paused && isSelfPause && player.gamesPlayed < arenaState.settings.minGamesBeforePause) {
      toast.error(t("arena.alertMinGamesBeforePause", { count: arenaState.settings.minGamesBeforePause }))
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

  const assignTablesToMatches = (matches: Match[]) => assignTablesToMatchesForState(matches, arenaState)

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
      toast.error(t("arena.alertOnlyOwnMatches"))
      return
    }

    // Store temporary submission (not yet confirmed)
    setPlayerSubmissions((prev) => ({
      ...prev,
      [matchId]: { result, confirmed: false },
    }))
  }

  const handlePlayerConfirm = async (
    matchId: string,
    result?: "player1-win" | "draw" | "player2-win",
  ) => {
    const effectiveResult = result ?? playerSubmissions[matchId]?.result
    if (DEBUG) console.log("[v0] Player confirming result:", matchId, "result:", effectiveResult, "from arg:", !!result, "playerId:", playerSession?.playerId)
    if (!playerSession?.playerId) {
      toast.error(t("arena.alertMissingPlayerSession"))
      return
    }

    const match = arenaState.pairedMatches.find((m) => m.id === matchId)
    if (!match) {
      if (DEBUG) console.log("[v0] Match not found:", matchId)
      return
    }

    const isPlayerInMatch = match.player1.id === playerSession.playerId || match.player2.id === playerSession.playerId
    if (!isPlayerInMatch) {
      if (DEBUG) console.log("[v0] Player not in match, rejecting confirmation")
      return
    }

    if (!effectiveResult) {
      console.warn("[v0] No result to submit (pass result to onConfirm or set via onSubmit first):", matchId)
      return
    }

    // Mark as confirmed in local state
    setPlayerSubmissions((prev) => ({
      ...prev,
      [matchId]: { result: effectiveResult, confirmed: true },
    }))

    try {
      if (DEBUG) console.log("[v0] Sending POST /api/tournament/match/submit", { matchId, result: effectiveResult, playerId: playerSession.playerId })
      const res = await fetch("/api/tournament/match/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          result: effectiveResult,
          confirmed: true,
          playerId: playerSession.playerId,
        }),
      })

      const response = await res
        .json()
        .catch(() => ({ success: false, error: "Invalid response", errorCode: "INTERNAL_ERROR" as const }))
      // Always log so we can see what the server returned (helps debug guest submission)
      console.log("[result-submit] Response:", res.status, JSON.stringify(response))
      if (DEBUG) console.log("[v0] Submit response:", res.status, response)

      if (!res.ok) {
        console.error("[v0] Submit result HTTP error:", res.status, response?.error ?? res.statusText)
        toast.error(messageForSubmitResponse(t, response, "arena.alertRequestFailed", { status: res.status }))
        setPlayerSubmissions((prev) => ({
          ...prev,
          [matchId]: { ...prev[matchId], confirmed: false },
        }))
        return
      }

      if (!response.success) {
        console.error("[v0] Server rejected submission:", response.error, response.errorCode)
        toast.error(messageForSubmitResponse(t, response, "arena.toastResultSubmitFailed"))
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
        if (DEBUG) console.log("[v0] Match submission saved:", updatedMatch, "matchCompleted:", response.matchCompleted, "updatedPlayers:", response.updatedPlayers?.length)

        // Server may have already completed the match and updated player scores
        if (response.matchCompleted && response.updatedPlayers?.length === 2) {
          const isDraw = updatedMatch.player1_submission === "draw"
          const winnerId = isDraw
            ? undefined
            : updatedMatch.player1_submission === "player1-win"
              ? updatedMatch.player1_id
              : updatedMatch.player2_id
          const completedAt = Date.now()
          const serverPlayerUpdates = response.updatedPlayers as {
            id: string
            points: number
            games_played: number
            streak: number
          }[]
          const playerUpdates = new Map(serverPlayerUpdates.map((u) => [u.id, u]))

          setArenaState((prev) => {
            const updatedPlayers = prev.players.map((p) => {
              const u = playerUpdates.get(p.id)
              if (!u) return p
              return { ...p, score: u.points, gamesPlayed: u.games_played, streak: u.streak }
            })
            const match = prev.pairedMatches.find((m) => m.id === matchId)
            const completedMatch =
              match &&
              ({
                ...match,
                endTime: completedAt,
                result: { winnerId, isDraw, completed: true, completedAt },
              } as typeof match)
            return {
              ...prev,
              players: updatedPlayers,
              pairedMatches: prev.pairedMatches.filter((m) => m.id !== matchId),
              allTimeMatches: completedMatch ? [...prev.allTimeMatches, completedMatch] : prev.allTimeMatches,
            }
          })
          return
        }

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

        // If both agreed but server didn't complete (e.g. old deployment), organizer path can still run
        if (
          updatedMatch.player1_submission &&
          updatedMatch.player2_submission &&
          updatedMatch.player1_submission === updatedMatch.player2_submission &&
          !response.matchCompleted
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
      const msg = error instanceof Error ? error.message : String(error)
      console.error("[result-submit] Request failed:", msg, error)
      toast.error(
        msg.includes("fetch") || msg.includes("Network")
          ? t("arena.toastResultSubmitFailedNetwork")
          : t("arena.toastResultSubmitFailed"),
      )
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

      // C4 fix: find opponent's game by counting occurrences of this matchup,
      // not by positional index comparison (which breaks for rematches).
      let pairOccurrence = 0
      for (let i = 0; i <= gameIndex; i++) {
        if (player.opponentIds[i] === opponentId) pairOccurrence++
      }
      let opponentGameIndex = -1
      let count = 0
      for (let j = 0; j < opponent.opponentIds.length; j++) {
        if (opponent.opponentIds[j] === playerId) {
          count++
          if (count === pairOccurrence) {
            opponentGameIndex = j
            break
          }
        }
      }

      if (opponentGameIndex === -1) {
        console.error("[v0] Could not find corresponding game in opponent's history")
        return prev
      }

      const newOpponentResult: "W" | "D" | "L" = newResult === "W" ? "L" : newResult === "L" ? "W" : "D"

      // C5 fix: recalculate ALL points from scratch for both players
      // so streak changes cascade correctly to subsequent games.
      const recalcAll = (results: ("W" | "D" | "L")[]) => {
        let streak = 0
        let total = 0
        const earned: number[] = []
        for (const r of results) {
          const isW = r === "W"
          const isD = r === "D"
          const pts = calculatePointsFromSettings(isW, isD, streak, prev.settings)
          earned.push(pts)
          total += pts
          streak = isD ? 0 : isW ? streak + 1 : 0
        }
        return { total, streak, earned }
      }

      const playerResults = [...player.gameResults]
      playerResults[gameIndex] = newResult
      const p = recalcAll(playerResults)

      const oppResults = [...opponent.gameResults]
      oppResults[opponentGameIndex] = newOpponentResult
      const o = recalcAll(oppResults)

      const updatedPlayers = prev.players.map((pl) => {
        if (pl.id === playerId) {
          return { ...pl, score: p.total, streak: p.streak, gameResults: playerResults, pointsEarned: p.earned }
        }
        if (pl.id === opponentId) {
          return { ...opponent, score: o.total, streak: o.streak, gameResults: oppResults, pointsEarned: o.earned }
        }
        return pl
      })

      if (tournamentId) {
        savePlayers(tournamentId, updatedPlayers).catch((err) => {
          console.error("[v0] Error saving players after override:", formatSupabaseError(err))
        })
      }

      return { ...prev, players: updatedPlayers }
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
          console.error("[v0] Error saving players after match completion:", formatSupabaseError(err))
        })
        saveMatches(tournamentId, mergeMatchesForSave(updated.pairedMatches, updated.allTimeMatches)).catch((err) => {
          console.error("[v0] Error saving matches after match completion:", formatSupabaseError(err))
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
          <div className="mb-3 space-y-1">
            <p className="text-sm font-medium text-muted-foreground truncate" title={displayName}>
              {displayName}
            </p>
            <div className="flex items-center justify-between gap-2">
            <h1 className="text-2xl font-bold">{t("arena.currentPairings")}</h1>
            <Button variant="outline" size="sm" onClick={() => setIsFullScreenPairings(false)}>
              <X className="h-4 w-4 mr-2" />
              {t("common.close")}
            </Button>
            </div>
          </div>

          {sortedPendingMatches.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {sortedPendingMatches.map((match) => (
                <PairingMatchCard key={match.id} match={match} showSubmissionStatus={false} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">{t("arena.noActivePairings")}</p>
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
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-background/80 backdrop-blur-sm"
            onClick={() => setShowSettings(false)}
          >
            <div
              className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8"
              onClick={(e) => e.stopPropagation()}
            >
              <TournamentSettingsPanel
                embedded
                settings={arenaState.settings}
                onUpdateSettings={handleUpdateSettings}
                onClose={() => setShowSettings(false)}
                showSimulator={showSimulator}
                onToggleSimulator={(show) => setShowSimulator(show)}
                isOrganizer={isOrganizer}
              />
              {arenaState.allTimeMatches.length > 0 && (
                <AlgorithmComparisonPanel
                  tournamentId={tournamentId || ""}
                  players={arenaState.players}
                  matches={arenaState.allTimeMatches}
                  settings={arenaState.settings}
                />
              )}
            </div>
          </div>
        )}

        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("tournamentHeader.deleteTournamentTitle")}</DialogTitle>
              <DialogDescription>{t("tournamentHeader.deleteTournamentDescription")}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={deletingTournament}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!tournamentId || deletingTournament) return
                  setDeletingTournament(true)
                  const result = await deleteTournament(tournamentId)
                  setDeletingTournament(false)
                  setShowDeleteDialog(false)
                  if (result.success) {
                    toast.success(t("tournamentHeader.deleteTournamentSuccess"))
                    router.push("/")
                  } else {
                    toast.error(result.error ?? t("common.errorGeneric"))
                  }
                }}
                disabled={deletingTournament}
              >
                {deletingTournament ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                {t("tournamentHeader.deleteTournamentConfirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                  <p className="font-semibold text-sm">
                    {t("arena.welcomePlayerTitle", { name: playerSession?.playerName ?? "" })}
                  </p>
                  <p className="text-sm text-muted-foreground">{t("arena.welcomePlayerBody")}</p>
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
          <ArenaTournamentHeader
            displayName={displayName}
            tournamentId={tournamentId}
            isCurrentUserInTournament={isCurrentUserInTournament}
            userRole={userRole}
            organizerName={organizerName}
            isOrganizer={isOrganizer}
            tournamentMetadata={tournamentMetadata}
            tournamentStatus={arenaState.status}
            arenaIsActive={arenaState.isActive}
            pairedMatches={arenaState.pairedMatches}
            pairingAlgorithm={arenaState.settings.pairingAlgorithm}
            hasNewPairing={hasNewPairing}
            timeRemainingFormatted={formatTime(timeRemaining)}
            completionRatio={completionRatio}
            canEndTournament={permissions.canEndTournament}
            canAccessSettings={permissions.canAccessSettings}
            showPairingStatusTab={isOrganizer && arenaState.isActive}
            onEndTournament={endTournament}
            onOpenDeleteDialog={() => setShowDeleteDialog(true)}
            onOpenSettings={() => setShowSettings(true)}
          />

          <TabsContent value="players" className="space-y-2">
            <ArenaPlayersTab
              tournamentId={tournamentId}
              status={arenaState.status}
              isActive={arenaState.isActive}
              allowLateJoin={arenaState.settings.allowLateJoin}
              players={arenaState.players}
              maxSimultaneousPairings={maxSimultaneousPairings}
              tableCountInput={tableCountInput}
              tournamentDurationInput={tournamentDurationInput}
              isOrganizer={isOrganizer}
              currentUserId={currentUserId}
              isCurrentUserInTournament={isCurrentUserInTournament}
              joiningSelf={joiningSelf}
              checkingIn={checkingIn}
              markingPresentPlayerId={markingPresentPlayerId}
              renamingPlayerId={renamingPlayerId}
              canStartTournament={permissions.canStartTournament}
              canAccessQR={permissions.canAccessQR}
              onTableCountChange={setTableCountInput}
              onDurationChange={setTournamentDurationInput}
              onStartTournament={handleStartTournament}
              onJoinAsSelf={joinAsSelf}
              onCheckIn={handleCheckIn}
              onAddGuestPlayer={handleAddGuestPlayer}
              onSelectUser={handleSelectUser}
              onRemovePlayer={removePlayer}
              onTogglePause={isOrganizer ? togglePause : undefined}
              onMarkPresent={isOrganizer ? handleMarkPresent : undefined}
              onRenamePlayer={isOrganizer ? handleRenamePlayer : undefined}
            />
          </TabsContent>

          <TabsContent value="pairings">
            <ArenaPairingsTab
              matches={sortedPendingMatches}
              onOpenFullScreen={() => setIsFullScreenPairings(true)}
            />
          </TabsContent>

          <TabsContent value="pairingStatus" className="space-y-3">
            {isOrganizer && arenaState.isActive ? (
              <ArenaPairingStatusPanel
                arenaState={arenaState}
                tournamentMetadata={tournamentMetadata}
                isActive={arenaState.isActive}
                waitingForFinalResults={waitingForFinalResults}
                onReduceWaitOneMinute={handleReduceWaitOneMinute}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="results">
            <ArenaResultsTab
              tournamentStatus={arenaState.status}
              isActive={arenaState.isActive}
              pairedMatches={arenaState.pairedMatches}
              players={arenaState.players}
              effectivePlayerView={effectivePlayerView}
              showSimulator={showSimulator}
              playerSession={
                playerSession?.playerId && playerSession?.role
                  ? { playerId: playerSession.playerId, role: playerSession.role as "player" | "organizer" }
                  : undefined
              }
              canRecordResults={permissions.canRecordAnyResult}
              onRecordResult={(id, winner, isDraw) => recordResult(id, winner, isDraw ?? false)}
              onPlayerSubmit={handlePlayerSubmit}
              onPlayerConfirm={handlePlayerConfirm}
              onPlayerCancel={handlePlayerCancel}
            />
          </TabsContent>

          <TabsContent value="standings">
            <Leaderboard
              players={arenaState.players}
              isPlayerView={effectivePlayerView}
              onOverrideResult={!effectivePlayerView ? overrideResult : undefined}
              settings={arenaState.settings}
            />
          </TabsContent>
        </Tabs>

        <Dialog
          open={showEndDialog && isOrganizer}
          onOpenChange={(open) => isOrganizer && setShowEndDialog(open)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("arena.endTournamentTitle")}</DialogTitle>
              <DialogDescription>
                {arenaState.pairedMatches.filter((m) => !m.result?.completed).length > 0
                  ? t("arena.endTournamentWithPending", { count: arenaState.pairedMatches.filter((m) => !m.result?.completed).length })
                  : t("arena.endTournamentConfirm")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-col gap-2">
              <Button variant="destructive" onClick={handleEndImmediately} className="w-full">
                {t("arena.endImmediately")}
              </Button>
              {arenaState.pairedMatches.filter((m) => !m.result?.completed).length > 0 && (
                <Button variant="default" onClick={handleWaitForFinalResults} className="w-full">
                  {t("arena.waitForResults")}
                </Button>
              )}
              <Button variant="outline" onClick={() => setShowEndDialog(false)} className="w-full">
                {t("common.cancel")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {waitingForFinalResults && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-yellow-500 text-black px-4 py-2 rounded-lg shadow-lg">
            {t("arena.waitingForResultsBanner")}
          </div>
        )}
      </div>
    </div>
  )
}
