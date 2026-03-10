"use client"

import { useState, useEffect, Dispatch, SetStateAction } from "react"

const DEBUG = process.env.NODE_ENV === "development"

export interface ArenaSessionData {
  tournamentId: string
  playerName?: string
  playerId?: string
  role?: "organizer" | "player"
}

export interface PlayerSessionResult {
  playerSession: ArenaSessionData | null
  showWelcomeMessage: boolean
  setShowWelcomeMessage: Dispatch<SetStateAction<boolean>>
}

export function usePlayerSession(
  initialTournamentId: string,
  isActive: boolean,
  effectivePlayerView: boolean,
  activeTab: string,
  setActiveTab: Dispatch<SetStateAction<string>>,
): PlayerSessionResult {
  const [playerSession, setPlayerSession] = useState<ArenaSessionData | null>(null)
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false)

  // Restore session from localStorage
  useEffect(() => {
    const sessionData = localStorage.getItem("tournamentPlayer")
    if (DEBUG) console.log("[arena] Checking session data:", sessionData)
    if (sessionData) {
      try {
        const parsed: ArenaSessionData = JSON.parse(sessionData)
        if (parsed.tournamentId === initialTournamentId && parsed.role === "player") {
          if (DEBUG) console.log("[arena] Setting player view mode")
          setPlayerSession(parsed)
          const hasSeenWelcome = localStorage.getItem(
            `welcome_${initialTournamentId}_${parsed.playerId}`,
          )
          if (!hasSeenWelcome && isActive) {
            setShowWelcomeMessage(true)
            localStorage.setItem(`welcome_${initialTournamentId}_${parsed.playerId}`, "true")
          }
        }
      } catch (err) {
        console.error("[arena] Error parsing session:", err)
      }
    }
  }, [initialTournamentId, isActive])

  // Redirect away from Players tab when in player view
  useEffect(() => {
    if (effectivePlayerView && activeTab === "players") {
      setActiveTab("pairings")
    }
  }, [effectivePlayerView, activeTab])

  return { playerSession, showWelcomeMessage, setShowWelcomeMessage }
}
