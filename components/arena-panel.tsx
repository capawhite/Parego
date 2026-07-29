"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Leaderboard } from "./leaderboard"
import { TournamentPodium } from "./tournament-podium"
import { TournamentSettingsPanel } from "./tournament-settings"
import { AlgorithmComparisonPanel } from "./algorithm-comparison-panel"
import type { ArenaState, Player, Match, TournamentSettings } from "@/lib/types"
import { isPairingHeartbeatStale } from "@/lib/tournament/pairing-loop-gate"
import {
  X,
  Trophy,
  Loader2,
  Trash2,
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
import { useRouter } from "next/navigation"
import { ArenaPlayersTab } from "@/components/tournament/arena-players-tab"
import { ArenaPairingsTab } from "@/components/tournament/arena-pairings-tab"
import { ArenaPairingStatusPanel } from "@/components/tournament/arena-pairing-status-panel"
import { ArenaResultsTab } from "@/components/tournament/arena-results-tab"
import { ArenaTournamentHeader } from "@/components/tournament/arena-tournament-header"
import { ArenaFullscreenPairings } from "@/components/tournament/arena-fullscreen-pairings"
import {
  getGuestSessionHistory,
  getConversionPromptDismissed,
  type GuestSessionEntry,
} from "@/lib/guest-session-history"
import { ConversionPrompt, type ConversionTrigger } from "@/components/conversion-prompt"
import { deleteTournament } from "@/app/actions/delete-tournament"
import { pairSwissRound } from "@/app/actions/pair-swiss-round"
import {
  canPairNextSwissRound,
  isSwissAlgorithm,
  maybeAdvanceSwissLastCompletedRound,
  nextSwissRoundToPair,
} from "@/lib/pairing/swiss"
import { loadPlayers, loadMatches } from "@/lib/database/tournament-db"
import { toast } from "sonner"
import { useI18n } from "@/components/i18n-provider"
import { useRealtime } from "@/hooks/tournament/use-realtime"
import { usePairingLoop } from "@/hooks/tournament/use-pairing-loop"
import { usePlayerSubmit } from "@/hooks/tournament/use-player-submit"
import { useTournamentLifecycle } from "@/hooks/tournament/use-tournament-lifecycle"
import { useArenaPlayers } from "@/hooks/tournament/use-arena-players"
import { useArenaMatchResults } from "@/hooks/tournament/use-arena-match-results"
import { useArenaLifecycle } from "@/hooks/tournament/use-arena-lifecycle"
import { useArenaTournamentLoad } from "@/hooks/tournament/use-arena-tournament-load"
import { useArenaAutosave } from "@/hooks/tournament/use-arena-autosave"
import { useArenaCooldown } from "@/hooks/tournament/use-arena-cooldown"
import { useArenaPlayerSession, type ArenaSessionData } from "@/hooks/tournament/use-arena-player-session"
import { useArenaPlayersRefresh } from "@/hooks/tournament/use-arena-players-refresh"
import { formatDurationClock } from "@/lib/tournament/format-duration"

const TOURNAMENT_DURATION = 60 * 60 * 1000 // 1 hour in milliseconds

// Debug logging - set to false in production
const DEBUG = process.env.NODE_ENV === "development"

interface ArenaPanelProps {
  tournamentId: string
  tournamentName: string
  isPlayerView?: boolean
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
  const [swissPairBusy, setSwissPairBusy] = useState(false)

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
    // Signed-in players with a seat may submit; guests may not. Organizers who also have a player seat can submit their own games.
    canSubmitOwnResult:
      userRole === "registered-player" || (isOrganizer && isCurrentUserInTournament),
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
    // Server dual-agree completion owns scoring; do not re-apply points locally.
  })

  usePairingLoop({
    tournamentId,
    isOrganizer,
    isActive: arenaState.isActive,
    waitingForFinalResults,
    pairingAlgorithm: arenaState.settings.pairingAlgorithm,
    useServerPairing: true,
  })

  const { submitResult } = usePlayerSubmit()
  const { start: startTournamentLifecycle } = useTournamentLifecycle({ tournamentId })

  const {
    checkingIn,
    markingPresentPlayerId,
    renamingPlayerId,
    joiningSelf,
    addPlayer,
    handleSelectUser,
    handleAddGuestPlayer,
    handleAddPlayersFromRoster,
    handleCheckIn,
    handleMarkPresent,
    handleRenamePlayer,
    joinAsSelf,
    removePlayer,
    togglePause,
  } = useArenaPlayers({
    tournamentId,
    arenaState,
    setArenaState,
    isOrganizer,
    isCurrentUserInTournament,
    currentUserId,
    currentPlayerInTournament,
    playerSession,
    userName,
    userRating,
    userRatingBand,
    userCountry,
    tournamentMetadata,
    t,
    onPlayerNameCleared: () => setPlayerNameInput(""),
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

  // End of event: guest sees podium — strong nudge to save results
  useEffect(() => {
    if (
      showPodium &&
      userRole === "guest-player" &&
      !getConversionPromptDismissed("end_event") &&
      !showConversionPrompt
    ) {
      setShowConversionPrompt("end_event")
    }
  }, [showPodium, userRole, showConversionPrompt])

  useArenaTournamentLoad({
    tournamentId,
    tournamentDurationMs: TOURNAMENT_DURATION,
    setArenaState,
    setIsLoading,
    setCurrentUserId,
    setUserName,
    setUserRating,
    setUserRatingBand,
    setUserCountry,
    setDisplayName,
    setOrganizerId,
    setOrganizerName,
    setTournamentMetadata,
    setCurrentPlayerInTournament,
  })

  useArenaAutosave({
    tournamentId,
    isLoading,
    isOrganizer,
    displayName,
    arenaState,
    tournamentMetadata,
    organizerId,
    currentUserId,
    suppressRealtime,
  })

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

  const recordedCompletedMatchIdsRef = useRef<Set<string>>(new Set())

  const { handleReduceWaitOneMinute } = useArenaCooldown({
    arenaState,
    isOrganizer,
    waitingForFinalResults,
    hasVenue: tournamentMetadata?.latitude != null && tournamentMetadata?.longitude != null,
    t,
  })

  // When organizer is in "wait for final results" and all matches are complete (e.g. via Realtime),
  // persist tournament as completed so players see the correct status.
  // An empty paired list counts as complete: dual-submit completion removes matches from it.
  useEffect(() => {
    if (
      !tournamentId ||
      !isOrganizer ||
      !waitingForFinalResults ||
      arenaState.status === "completed"
    )
      return
    const hasIncomplete = arenaState.pairedMatches.some((m) => !m.result?.completed)
    if (hasIncomplete) return
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

  useArenaPlayerSession({
    initialTournamentId: initialTournamentId || "",
    arenaIsActive: arenaState.isActive,
    setPlayerSession,
    setShowWelcomeMessage,
  })

  useArenaPlayersRefresh({
    tournamentId,
    status: arenaState.status,
    activeTab,
    isLoading,
    setArenaState,
  })

  const {
    handleStartTournament,
    endTournament,
    handleEndImmediately,
    handleWaitForFinalResults,
    finalizeEndTournament,
  } = useArenaLifecycle({
    tournamentId,
    arenaState,
    setArenaState,
    displayName,
    tableCountInput,
    tournamentDurationInput,
    tournamentMetadata,
    organizerId,
    currentUserId,
    suppressRealtime,
    startTournamentLifecycle,
    setTimeRemaining,
    setActiveTab,
    setShowEndDialog,
    setWaitingForFinalResults,
    setShowPodium,
    t,
  })

  const closePodium = () => {
    setShowPodium(false)
  }

  const {
    recordResult,
    handlePlayerSubmit,
    handlePlayerConfirm,
    handlePlayerCancel,
    overrideResult,
  } = useArenaMatchResults({
    tournamentId,
    arenaState,
    setArenaState,
    isOrganizer,
    playerSession,
    playerSubmissions,
    setPlayerSubmissions,
    recordedCompletedMatchIdsRef,
    waitingForFinalResults,
    finalizeEndTournament,
    submitResult,
    userRole,
    showConversionPrompt,
    setShowConversionPrompt,
    t,
  })

  const maxSimultaneousPairings = Math.floor(arenaState.players.length / 2)
  const pendingMatches = arenaState.pairedMatches.filter((m) => !m.result?.completed)
  const sortedPendingMatches = [...pendingMatches].sort((a, b) => {
    if (a.tableNumber && b.tableNumber) {
      return a.tableNumber - b.tableNumber
    }
    return 0
  })

  const isSwiss = isSwissAlgorithm(arenaState.settings.pairingAlgorithm)
  const allMatchesForSwiss = [...arenaState.pairedMatches, ...arenaState.allTimeMatches]
  const nextSwissRound = isSwiss ? nextSwissRoundToPair(arenaState.settings, allMatchesForSwiss) : null
  const plannedSwissRounds = arenaState.settings.plannedSwissRounds ?? 1
  const openSwissRound = allMatchesForSwiss.reduce<number | null>((max, m) => {
    if (m.swissRound == null || m.result?.completed || m.matchKind === "pairing-bye") return max
    return max == null ? m.swissRound : Math.max(max, m.swissRound)
  }, null)
  const swissCurrentRound =
    openSwissRound ??
    nextSwissRound ??
    Math.min(Math.max(arenaState.settings.swissLastCompletedRound ?? 0, 1), plannedSwissRounds)

  const swissCanPair =
    isOrganizer &&
    arenaState.isActive &&
    isSwiss &&
    canPairNextSwissRound(arenaState.settings, allMatchesForSwiss)

  const handlePairSwissRound = useCallback(async () => {
    if (!tournamentId || !isOrganizer) return
    setSwissPairBusy(true)
    try {
      const res = await pairSwissRound(tournamentId)
      if (!res.success) {
        toast.error(res.error || t("swiss.pairingFailed"))
        return
      }
      toast.success(t("swiss.pairedRound", { round: res.round ?? "" }))
      const [players, matches] = await Promise.all([loadPlayers(tournamentId), loadMatches(tournamentId)])
      setArenaState((prev) => {
        const settings = maybeAdvanceSwissLastCompletedRound(
          { ...prev.settings, pairingAlgorithm: "swiss" },
          matches,
        )
        return {
          ...prev,
          players,
          pairedMatches: matches.filter((m) => !m.result?.completed),
          allTimeMatches: matches.filter((m) => !!m.result?.completed),
          settings,
        }
      })
    } finally {
      setSwissPairBusy(false)
    }
  }, [tournamentId, isOrganizer, setArenaState, t])

  const handleUpdateSettings = async (newSettings: TournamentSettings) => {
    setArenaState((prev) => ({
      ...prev,
      settings: newSettings,
      tableCount: newSettings.tableCount,
    }))
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
      <ArenaFullscreenPairings
        displayName={displayName}
        matches={sortedPendingMatches}
        onClose={() => setIsFullScreenPairings(false)}
      />
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
                playerCount={arenaState.players.filter((p) => !p.hasLeft).length}
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
            strong={showConversionPrompt === "end_event"}
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

        {!isOrganizer &&
          arenaState.isActive &&
          !waitingForFinalResults &&
          isPairingHeartbeatStale(arenaState.settings.pairingHeartbeatAt) && (
            <Card className="border-amber-500/40 bg-amber-500/5 mb-4">
              <CardContent className="pt-4 pb-3 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">{t("arena.pairingPausedTitle")}</p>
                  <p className="text-sm text-muted-foreground">{t("arena.pairingPausedBody")}</p>
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
            timeRemainingFormatted={formatDurationClock(timeRemaining)}
            completionRatio={completionRatio}
            canEndTournament={permissions.canEndTournament}
            canAccessSettings={permissions.canAccessSettings}
            showPairingStatusTab={isOrganizer && arenaState.isActive && !isSwiss}
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
              onAddPlayersFromRoster={handleAddPlayersFromRoster}
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
              swissControls={
                isSwiss && isOrganizer
                  ? {
                      currentRound: swissCurrentRound,
                      plannedRounds: plannedSwissRounds,
                      canPairNext: swissCanPair,
                      pairingBusy: swissPairBusy,
                      onPairNextRound: handlePairSwissRound,
                    }
                  : null
              }
            />
          </TabsContent>

          <TabsContent value="pairingStatus" className="space-y-3">
            {isOrganizer && arenaState.isActive && !isSwiss ? (
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
              canSubmitOwnResult={permissions.canSubmitOwnResult}
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
