"use client"

import { useEffect, type Dispatch, type SetStateAction } from "react"

const DEBUG = process.env.NODE_ENV === "development"

export type ArenaSessionData = {
  tournamentId: string
  playerName?: string
  playerId?: string
  role?: "organizer" | "player"
}

type UseArenaPlayerSessionOptions = {
  initialTournamentId: string
  arenaIsActive: boolean
  setPlayerSession: Dispatch<SetStateAction<ArenaSessionData | null>>
  setShowWelcomeMessage: Dispatch<SetStateAction<boolean>>
}

/** Restore guest/player session from localStorage for this tournament. */
export function useArenaPlayerSession({
  initialTournamentId,
  arenaIsActive,
  setPlayerSession,
  setShowWelcomeMessage,
}: UseArenaPlayerSessionOptions): void {
  useEffect(() => {
    const sessionData = localStorage.getItem("tournamentPlayer")
    if (DEBUG) console.log("[v0] Checking session data:", sessionData)
    if (!sessionData) {
      if (DEBUG) console.log("[v0] No session found, defaulting to organizer view")
      return
    }
    try {
      const parsed: ArenaSessionData = JSON.parse(sessionData)
      if (DEBUG) {
        console.log("[v0] Parsed session:", parsed)
        console.log("[v0] Tournament ID match:", parsed.tournamentId, "===", initialTournamentId)
      }
      if (parsed.tournamentId === initialTournamentId && parsed.role === "player") {
        if (DEBUG) console.log("[v0] Setting player view mode")
        setPlayerSession(parsed)
        const hasSeenWelcome = localStorage.getItem(`welcome_${initialTournamentId}_${parsed.playerId}`)
        if (!hasSeenWelcome && arenaIsActive) {
          setShowWelcomeMessage(true)
          localStorage.setItem(`welcome_${initialTournamentId}_${parsed.playerId}`, "true")
        }
      } else if (parsed.tournamentId === initialTournamentId && parsed.role === "organizer") {
        if (DEBUG) console.log("[v0] Setting organizer view mode")
      }
    } catch (err) {
      console.error("[v0] Error parsing session:", err)
    }
  }, [initialTournamentId, arenaIsActive, setPlayerSession, setShowWelcomeMessage])
}
