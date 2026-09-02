"use client"

import { useCallback, useState, type Dispatch, type SetStateAction } from "react"
import { toast } from "sonner"
import { joinTournamentAction } from "@/app/actions/join-tournament"
import { verifyAndCheckIn, markPresentOverride, checkVenueProximity } from "@/app/actions/check-in"
import { updatePlayerPauseState } from "@/app/actions/update-player-pause"
import { removePlayerAction } from "@/app/actions/remove-player"
import { renamePlayer } from "@/app/actions/rename-player"
import { generateGuestUsername } from "@/lib/guest-names"
import { addGuestSession } from "@/lib/guest-session-history"
import { getDeviceId } from "@/lib/device-id"
import { resolvePairingRating } from "@/lib/fide/time-control"
import type { FideRatings } from "@/lib/fide/types"
import type { ArenaState, Player } from "@/lib/types"
import type { useI18n } from "@/components/i18n-provider"

type TFunction = ReturnType<typeof useI18n>["t"]

const DEBUG = process.env.NODE_ENV === "development"

type UseArenaPlayersOptions = {
  tournamentId: string | null
  arenaState: ArenaState
  setArenaState: Dispatch<SetStateAction<ArenaState>>
  isOrganizer: boolean
  isCurrentUserInTournament: boolean
  currentUserId: string | null
  currentPlayerInTournament: Player | null
  playerSession: { playerId?: string } | null
  userName: string
  userRating: number | null
  userRatingBand: string | null
  userFideRatings: FideRatings | null
  userFederation: string | null
  userCountry: string | null
  tournamentMetadata: {
    latitude?: number
    longitude?: number
  } | null
  t: TFunction
  onPlayerNameCleared?: () => void
}

/**
 * Player roster actions for ArenaPanel (add/join/check-in/remove/pause/rename).
 */
export function useArenaPlayers({
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
  userFideRatings,
  userFederation,
  userCountry,
  tournamentMetadata,
  t,
  onPlayerNameCleared,
}: UseArenaPlayersOptions) {
  // Roster flag: prefer FIDE federation code; fall back to geographic country.
  const rosterCountry = userFederation ?? userCountry

  const [checkingIn, setCheckingIn] = useState(false)
  const [markingPresentPlayerId, setMarkingPresentPlayerId] = useState<string | null>(null)
  const [renamingPlayerId, setRenamingPlayerId] = useState<string | null>(null)
  const [joiningSelf, setJoiningSelf] = useState(false)

  const resolveJoinRating = useCallback(
    (explicitRating?: number | null, ratingBand?: string | null) => {
      if (explicitRating !== undefined) return explicitRating
      return resolvePairingRating({
        ratingBand: ratingBand ?? userRatingBand,
        fideRatings: userFideRatings,
        profileRating: userRating,
        baseTimeMinutes: arenaState.settings.baseTimeMinutes,
        incrementSeconds: arenaState.settings.incrementSeconds,
      })
    },
    [
      arenaState.settings.baseTimeMinutes,
      arenaState.settings.incrementSeconds,
      userFideRatings,
      userRating,
      userRatingBand,
    ],
  )

  const applyJoinRating = useCallback(
    (playerId: string, rating: number | null | undefined) => {
      if (rating == null) return
      setArenaState((prev) => ({
        ...prev,
        players: prev.players.map((p) => (p.id === playerId ? { ...p, rating } : p)),
      }))
    },
    [setArenaState],
  )

  const addPlayer = useCallback(
    async (
      name: string,
      userId?: string,
      isGuest = false,
      addToGuestHistory = false,
      options?: { rating?: number | null },
    ) => {
      if (!name.trim()) return false

      const isDuplicate = arenaState.players.some((player) => {
        if (userId && player.userId === userId) return true
        if (player.name.toLowerCase() === name.toLowerCase()) return true
        return false
      })

      if (isDuplicate) {
        toast.error(t("arena.alertPlayerAlreadyInTournament"))
        return false
      }

      if (arenaState.isActive && !arenaState.settings.allowLateJoin) {
        toast.error(t("arena.alertLateJoinsNotAllowed"))
        return false
      }

      if (arenaState.isActive) {
        const newTotalPlayers = arenaState.players.length + 1
        const maxSimultaneousPairings = Math.floor(newTotalPlayers / 2)
        if (maxSimultaneousPairings > arenaState.tableCount) {
          toast.error(
            t("arena.alertCannotAddPlayerTables", {
              max: maxSimultaneousPairings,
              tables: arenaState.tableCount,
            }),
          )
          return false
        }
      }

      let rating: number | null
      if (options?.rating !== undefined) {
        rating = options.rating
      } else if (userId) {
        rating = userId === currentUserId ? resolveJoinRating() : null
      } else {
        rating = null
      }

      const newPlayer: Player = {
        id: globalThis.crypto.randomUUID(),
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
        isGuest,
        rating,
        buchholz: 0,
        sonnebornBerger: 0,
        country: rosterCountry,
      }

      setArenaState((prev) => ({
        ...prev,
        players: [...prev.players, newPlayer],
      }))
      onPlayerNameCleared?.()

      if (!tournamentId) return false

      let savedPlayerId = newPlayer.id
      try {
        const deviceId = addToGuestHistory ? getDeviceId() : null
        const joinResult = await joinTournamentAction({
          tournamentId,
          name: newPlayer.name,
          userId: userId || null,
          isGuest,
          rating: userId ? undefined : newPlayer.rating,
          ratingOverride: !userId,
          deviceId,
          asOrganizer: isOrganizer,
          playerId: newPlayer.id,
        })
        if (!joinResult.success) {
          if (joinResult.errorCode === "ALREADY_JOINED") {
            toast.error(t("arena.toastAlreadyJoinedFromDevice"))
          } else {
            console.error("[v0] Error saving player to database:", joinResult.error)
            toast.error(joinResult.error || t("arena.toastFailedToAddPlayer"))
          }
          setArenaState((prev) => ({
            ...prev,
            players: prev.players.filter((p) => p.id !== newPlayer.id),
          }))
          return false
        }
        if (joinResult.playerId && joinResult.playerId !== newPlayer.id) {
          savedPlayerId = joinResult.playerId
          setArenaState((prev) => ({
            ...prev,
            players: prev.players.map((p) =>
              p.id === newPlayer.id ? { ...p, id: joinResult.playerId! } : p,
            ),
          }))
        }
        applyJoinRating(savedPlayerId, joinResult.rating)
      } catch (error) {
        const err = error as Record<string, unknown>
        const msg = (err?.message as string) ?? (error instanceof Error ? error.message : String(error))
        console.error("[v0] Error saving player to database:", msg, error)
        toast.error(msg || t("arena.toastFailedToAddPlayer"))
        setArenaState((prev) => ({
          ...prev,
          players: prev.players.filter((p) => p.id !== newPlayer.id),
        }))
        return false
      }

      if (isGuest && addToGuestHistory) {
        addGuestSession({
          tournamentId,
          playerId: savedPlayerId,
          displayName: name,
        })
      }
      return true
    },
    [
      arenaState.players,
      arenaState.isActive,
      arenaState.settings.allowLateJoin,
      arenaState.tableCount,
      tournamentId,
      isOrganizer,
      currentUserId,
      userRating,
      userRatingBand,
      userFideRatings,
      userFederation,
      userCountry,
      rosterCountry,
      resolveJoinRating,
      applyJoinRating,
      setArenaState,
      onPlayerNameCleared,
      t,
    ],
  )

  const handleSelectUser = useCallback(
    async (user: { id: string; name: string; rating: number | null }) => {
      await addPlayer(user.name, user.id, false)
    },
    [addPlayer],
  )

  const handleAddGuestPlayer = useCallback(async () => {
    const existingNames = arenaState.players.map((p) => p.name)
    const guestUsername = generateGuestUsername(existingNames)
    await addPlayer(guestUsername, undefined, true, !currentUserId)
  }, [addPlayer, arenaState.players, currentUserId])

  const handleAddPlayersFromRoster = useCallback(
    async (
      rosterPlayers: Array<{
        name: string
        userId: string | null
        rating: number | null
        isGuest: boolean
      }>,
    ) => {
      let added = 0
      for (const p of rosterPlayers) {
        const ok = await addPlayer(
          p.name,
          p.userId ?? undefined,
          p.isGuest || !p.userId,
          false,
          { rating: p.rating },
        )
        if (ok) added += 1
      }
      return added
    },
    [addPlayer],
  )

  const handleCheckIn = useCallback(async () => {
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
            const result = await verifyAndCheckIn(
              tournamentId,
              position.coords.latitude,
              position.coords.longitude,
            )
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
  }, [tournamentId, currentUserId, setArenaState, t])

  const handleMarkPresent = useCallback(
    async (playerId: string) => {
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
    },
    [tournamentId, setArenaState, t],
  )

  const handleRenamePlayer = useCallback(
    async (playerId: string, newName: string) => {
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
    },
    [tournamentId, setArenaState, t],
  )

  const joinAsSelf = useCallback(async () => {
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

    const { playerNameExistsInTournament } = await import("@/lib/database/tournament-db")
    const nameTaken = tournamentId ? await playerNameExistsInTournament(tournamentId, userName) : false
    if (nameTaken) {
      toast.error(t("arena.toastNameExistsTryDifferent", { name: userName }))
      return
    }

    const hasVenue = tournamentMetadata?.latitude != null && tournamentMetadata?.longitude != null
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
                tournamentId,
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
      rating: resolveJoinRating(),
      score: 0,
      buchholz: 0,
      sonnebornBerger: 0,
      country: rosterCountry,
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
      checkedInAt,
      presenceSource,
    }

    setArenaState((prev) => ({
      ...prev,
      players: [...prev.players, newPlayer],
    }))

    if (!tournamentId) return

    try {
      const joinResult = await joinTournamentAction({
        tournamentId,
        name: newPlayer.name,
        userId: currentUserId,
        isGuest: false,
        checkedInAt: checkedInAt != null ? new Date(checkedInAt).toISOString() : null,
        presenceSource,
        playerId: newPlayer.id,
      })
      if (!joinResult.success) {
        console.error("[v0] Error saving player to database:", joinResult.error)
        toast.error(joinResult.error || t("arena.toastFailedToAddPlayer"))
        setArenaState((prev) => ({
          ...prev,
          players: prev.players.filter((p) => p.id !== newPlayer.id),
        }))
      } else {
        applyJoinRating(joinResult.playerId ?? newPlayer.id, joinResult.rating)
      }
    } catch (error) {
      console.error("[v0] Error saving player to database:", error)
      setArenaState((prev) => ({
        ...prev,
        players: prev.players.filter((p) => p.id !== newPlayer.id),
      }))
    }
  }, [
    currentUserId,
    userName,
    arenaState.status,
    arenaState.isActive,
    arenaState.settings.allowLateJoin,
    arenaState.players,
    arenaState.tableCount,
    isCurrentUserInTournament,
    tournamentId,
    tournamentMetadata,
    userRating,
    userRatingBand,
    userFideRatings,
    userFederation,
    userCountry,
    rosterCountry,
    setArenaState,
    t,
  ])

  const removePlayer = useCallback(
    (playerId: string) => {
      if (DEBUG) console.log("[v0] Attempting to remove player:", playerId)

      const playerToRemove = arenaState.players.find((p) => p.id === playerId)
      if (!playerToRemove) {
        if (DEBUG) console.log("[v0] Player not found:", playerId)
        return
      }

      if (!isOrganizer) {
        const isRemovingSelf = currentPlayerInTournament?.id === playerId
        if (!isRemovingSelf) {
          if (DEBUG) console.log("[v0] Permission denied: only organizer can remove other players")
          return
        }
      }

      const status = arenaState.status
      if (status === "active") {
        setArenaState((prev) => ({
          ...prev,
          players: prev.players.map((p) =>
            p.id === playerId ? { ...p, markedForRemoval: true, paused: true } : p,
          ),
        }))
      } else {
        setArenaState((prev) => ({
          ...prev,
          players: prev.players.filter((p) => p.id !== playerId),
        }))
      }

      if (!tournamentId) return

      setTimeout(async () => {
        try {
          const res = await removePlayerAction({ tournamentId, playerId })
          if (!res.ok) console.error("[v0] Failed to remove player in database:", res.error)
        } catch (error) {
          console.error("[v0] Error saving player removal:", error)
        }
      }, 100)
    },
    [
      arenaState.players,
      arenaState.status,
      isOrganizer,
      currentPlayerInTournament?.id,
      tournamentId,
      setArenaState,
    ],
  )

  const togglePause = useCallback(
    (playerId: string) => {
      const player = arenaState.players.find((p) => p.id === playerId)
      if (!player) return

      if (
        !player.paused &&
        !player.markedForPause &&
        !confirm(t("arena.confirmPausePlayer", { name: player.name }))
      ) {
        return
      }

      const isSelfPause =
        !isOrganizer &&
        (playerId === currentPlayerInTournament?.id || playerId === playerSession?.playerId)

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
        const nextMarked = !player.markedForPause
        setArenaState((prev) => ({
          ...prev,
          players: prev.players.map((p) =>
            p.id === playerId ? { ...p, markedForPause: nextMarked } : p,
          ),
        }))
        if (tournamentId) {
          void updatePlayerPauseState({
            tournamentId,
            playerId,
            isPaused: nextMarked,
          }).then((res) => {
            if (!res.ok) console.error("[v0] Failed to persist is_paused:", res.error)
          })
        }
      } else {
        const newPaused = !player.paused
        setArenaState((prev) => ({
          ...prev,
          players: prev.players.map((p) =>
            p.id === playerId ? { ...p, paused: newPaused, markedForPause: false } : p,
          ),
        }))
        if (tournamentId) {
          void updatePlayerPauseState({
            tournamentId,
            playerId,
            paused: newPaused,
            isPaused: false,
          }).then((res) => {
            if (!res.ok) console.error("[v0] Failed to persist pause:", res.error)
          })
        }
      }
    },
    [
      arenaState.players,
      arenaState.pairedMatches,
      arenaState.settings.allowSelfPause,
      arenaState.settings.minGamesBeforePause,
      isOrganizer,
      currentPlayerInTournament?.id,
      playerSession?.playerId,
      tournamentId,
      setArenaState,
      t,
    ],
  )

  return {
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
  }
}
