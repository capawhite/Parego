"use client"

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react"
import { toast } from "sonner"
import { recordOrganizerMatchResult, saveOrganizerPlayerScores } from "@/app/actions/record-match-result"
import { beginMatchResultRecording, releaseMatchResultRecording } from "@/lib/match-result-recording"
import { applyMatchResultToState } from "@/lib/tournament/apply-match-result"
import { calculatePointsFromSettings } from "@/lib/points"
import { loadPlayers } from "@/lib/database/tournament-db"
import { messageForSubmitResponse } from "@/lib/submit-client-message"
import type { ArenaState, Match, Player } from "@/lib/types"
import type { ConversionTrigger } from "@/components/conversion-prompt"
import type { useI18n } from "@/components/i18n-provider"
import { getConversionPromptDismissed } from "@/lib/guest-session-history"

type TFunction = ReturnType<typeof useI18n>["t"]

const DEBUG = process.env.NODE_ENV === "development"

type PlayerSubmission = {
  result: "player1-win" | "draw" | "player2-win"
  confirmed: boolean
}

type UseArenaMatchResultsOptions = {
  tournamentId: string | null
  arenaState: ArenaState
  setArenaState: Dispatch<SetStateAction<ArenaState>>
  isOrganizer: boolean
  playerSession: { playerId?: string } | null
  playerSubmissions: Record<string, PlayerSubmission>
  setPlayerSubmissions: Dispatch<SetStateAction<Record<string, PlayerSubmission>>>
  recordedCompletedMatchIdsRef: MutableRefObject<Set<string>>
  waitingForFinalResults: boolean
  finalizeEndTournament: () => void | Promise<void>
  submitResult: (
    matchId: string,
    result: "player1-win" | "draw" | "player2-win",
    confirmed: boolean,
  ) => Promise<{
    success: boolean
    error?: string
    errorCode?: string
    matchCompleted?: boolean
    match?: {
      player1_id: string
      player2_id: string
      player1_submission?: "player1-win" | "draw" | "player2-win" | null
      player2_submission?: "player1-win" | "draw" | "player2-win" | null
    }
    updatedPlayers?: { id: string; points: number; games_played: number; streak: number }[]
  }>
  userRole: string
  showConversionPrompt: ConversionTrigger | null
  setShowConversionPrompt: Dispatch<SetStateAction<ConversionTrigger | null>>
  t: TFunction
}

/**
 * Match result recording / player dual-submit / organizer override for ArenaPanel.
 * Organizer score writes go through service-role actions; player dual-agree via submit API.
 */
export function useArenaMatchResults({
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
}: UseArenaMatchResultsOptions) {
  const recordResult = useCallback(
    async (matchId: string, winnerId: string | undefined, isDraw: boolean, isForfeit = false) => {
      if (DEBUG) console.log("[v0] Recording result for match:", matchId, "isDraw:", isDraw, "winnerId:", winnerId, "isForfeit:", isForfeit)

      if (!beginMatchResultRecording(matchId, recordedCompletedMatchIdsRef.current)) return

      let newPairedMatches: Match[] = []
      let newAllTimeMatches: Match[] = []
      let newPlayers: Player[] = []
      let settingsSnapshot = arenaState.settings
      let appliedOk = false

      setArenaState((prev) => {
        const applied = applyMatchResultToState({
          pairedMatches: prev.pairedMatches,
          allTimeMatches: prev.allTimeMatches,
          players: prev.players,
          settings: prev.settings,
          matchId,
          winnerId,
          isDraw,
          isForfeit,
          removeCompletedFromPaired: prev.settings.pairingAlgorithm === "balanced-strength",
        })

        if (!applied.ok) {
          if (applied.reason === "not_found" || applied.reason === "pairing_bye") {
            releaseMatchResultRecording(matchId, recordedCompletedMatchIdsRef.current)
          }
          return prev
        }

        appliedOk = true
        newPairedMatches = applied.pairedMatches
        newAllTimeMatches = applied.allTimeMatches
        newPlayers = applied.players
        settingsSnapshot = prev.settings

        if (waitingForFinalResults) {
          const remainingMatches = newPairedMatches.filter((m) => m.id !== matchId && !m.result?.completed)
          if (remainingMatches.length === 0 && isOrganizer) {
            if (DEBUG) console.log("[v0] All final results entered, ending tournament")
            setTimeout(() => void finalizeEndTournament(), 500)
          }
        }

        return {
          ...prev,
          pairedMatches: newPairedMatches,
          allTimeMatches: newAllTimeMatches,
          players: newPlayers,
        }
      })

      if (tournamentId && isOrganizer && appliedOk) {
        const res = await recordOrganizerMatchResult({
          tournamentId,
          matchId,
          winnerId,
          isDraw,
          isForfeit,
          players: newPlayers,
          pairedMatches: newPairedMatches,
          allTimeMatches: newAllTimeMatches,
          settings: settingsSnapshot,
        })
        if (!res.success) {
          toast.error(res.error || t("arena.toastResultSubmitFailed"))
        }
      }
    },
    [
      recordedCompletedMatchIdsRef,
      setArenaState,
      waitingForFinalResults,
      isOrganizer,
      finalizeEndTournament,
      tournamentId,
      arenaState.settings,
      t,
    ],
  )

  const handlePlayerSubmit = useCallback(
    async (matchId: string, result: "player1-win" | "draw" | "player2-win") => {
      if (DEBUG) console.log("[v0] Player submitting result:", matchId, result)
      if (!playerSession) return

      const match = arenaState.pairedMatches.find((m) => m.id === matchId)
      if (!match) return

      const isPlayerInMatch =
        match.player1.id === playerSession.playerId || match.player2.id === playerSession.playerId
      if (!isPlayerInMatch) {
        toast.error(t("arena.alertOnlyOwnMatches"))
        return
      }

      setPlayerSubmissions((prev) => ({
        ...prev,
        [matchId]: { result, confirmed: false },
      }))
    },
    [playerSession, arenaState.pairedMatches, setPlayerSubmissions, t],
  )

  const handlePlayerConfirm = useCallback(
    async (matchId: string, result?: "player1-win" | "draw" | "player2-win") => {
      const effectiveResult = result ?? playerSubmissions[matchId]?.result
      if (!playerSession?.playerId) {
        toast.error(t("arena.alertMissingPlayerSession"))
        return
      }

      const match = arenaState.pairedMatches.find((m) => m.id === matchId)
      if (!match) return

      const isPlayerInMatch =
        match.player1.id === playerSession.playerId || match.player2.id === playerSession.playerId
      if (!isPlayerInMatch) return

      if (!effectiveResult) {
        console.warn("[v0] No result to submit:", matchId)
        return
      }

      setPlayerSubmissions((prev) => ({
        ...prev,
        [matchId]: { result: effectiveResult, confirmed: true },
      }))

      try {
        const response = await submitResult(matchId, effectiveResult, true)
        if (!response.success) {
          toast.error(messageForSubmitResponse(t, response, "arena.toastResultSubmitFailed"))
          setPlayerSubmissions((prev) => ({
            ...prev,
            [matchId]: { ...prev[matchId], confirmed: false },
          }))
          return
        }

        if (
          userRole === "guest-player" &&
          !getConversionPromptDismissed("result_rankings") &&
          !showConversionPrompt
        ) {
          setShowConversionPrompt("result_rankings")
        }

        const updatedMatch = response.match
        if (!updatedMatch) return

        if (response.matchCompleted) {
          const isDraw = updatedMatch.player1_submission === "draw"
          const winnerId = isDraw
            ? undefined
            : updatedMatch.player1_submission === "player1-win"
              ? updatedMatch.player1_id
              : updatedMatch.player2_id
          const completedAt = Date.now()

          let dbPlayers: Player[] | null = null
          if (tournamentId) {
            try {
              dbPlayers = await loadPlayers(tournamentId)
            } catch (err) {
              console.error("[result-submit] Failed to reload players after completion:", err)
            }
          }

          setArenaState((prev) => {
            const found = prev.pairedMatches.find((m) => m.id === matchId)
            const completedMatch =
              found &&
              ({
                ...found,
                endTime: completedAt,
                result: { winnerId, isDraw, completed: true, completedAt },
              } as typeof found)

            const players =
              dbPlayers ??
              prev.players.map((p) => {
                const u = response.updatedPlayers?.find((x) => x.id === p.id)
                if (!u) return p
                return { ...p, score: u.points, gamesPlayed: u.games_played, streak: u.streak }
              })

            return {
              ...prev,
              players,
              pairedMatches: prev.pairedMatches.filter((m) => m.id !== matchId),
              allTimeMatches: completedMatch ? [...prev.allTimeMatches, completedMatch] : prev.allTimeMatches,
            }
          })
          return
        }

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
        // Dual-agree completion is server-owned; no client recordResult fallback.
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
    },
    [
      playerSubmissions,
      playerSession,
      arenaState.pairedMatches,
      submitResult,
      t,
      userRole,
      showConversionPrompt,
      setShowConversionPrompt,
      tournamentId,
      setArenaState,
      setPlayerSubmissions,
    ],
  )

  const handlePlayerCancel = useCallback(
    (matchId: string) => {
      setPlayerSubmissions((prev) => {
        const updated = { ...prev }
        delete updated[matchId]
        return updated
      })
    },
    [setPlayerSubmissions],
  )

  const overrideResult = useCallback(
    async (playerId: string, gameIndex: number, newResult: "W" | "D" | "L") => {
      let updatedPlayers: Player[] | null = null

      setArenaState((prev) => {
        const player = prev.players.find((p) => p.id === playerId)
        if (!player || gameIndex >= player.gameResults.length) return prev

        const oldResult = player.gameResults[gameIndex]
        if (oldResult === newResult) return prev

        const opponentId = player.opponentIds[gameIndex]
        const opponent = prev.players.find((p) => p.id === opponentId)
        if (!opponent) return prev

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
        if (opponentGameIndex === -1) return prev

        const newOpponentResult: "W" | "D" | "L" = newResult === "W" ? "L" : newResult === "L" ? "W" : "D"

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

        updatedPlayers = prev.players.map((pl) => {
          if (pl.id === playerId) {
            return { ...pl, score: p.total, streak: p.streak, gameResults: playerResults, pointsEarned: p.earned }
          }
          if (pl.id === opponentId) {
            return { ...opponent, score: o.total, streak: o.streak, gameResults: oppResults, pointsEarned: o.earned }
          }
          return pl
        })

        return { ...prev, players: updatedPlayers }
      })

      if (tournamentId && isOrganizer && updatedPlayers) {
        const res = await saveOrganizerPlayerScores({ tournamentId, players: updatedPlayers })
        if (!res.success) {
          toast.error(res.error || t("arena.toastResultSubmitFailed"))
        }
      }
    },
    [setArenaState, tournamentId, isOrganizer, t],
  )

  return {
    recordResult,
    handlePlayerSubmit,
    handlePlayerConfirm,
    handlePlayerCancel,
    overrideResult,
  }
}
