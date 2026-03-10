"use client"

import { useState, useEffect } from "react"

export interface TournamentTimerResult {
  timeRemaining: number
  setTimeRemaining: React.Dispatch<React.SetStateAction<number>>
  formattedTime: string
}

export function useTournamentTimer(
  isActive: boolean,
  tournamentStartTime: number | null,
  tournamentDuration: number,
  waitingForFinalResults: boolean,
  onExpire: () => void,
): TournamentTimerResult {
  const [timeRemaining, setTimeRemaining] = useState(tournamentDuration)

  useEffect(() => {
    if (!isActive || !tournamentStartTime) return

    // Set initial value immediately
    const elapsed = Date.now() - tournamentStartTime
    const remaining = Math.max(0, tournamentDuration - elapsed)
    setTimeRemaining(remaining)

    const interval = setInterval(() => {
      const elapsed = Date.now() - tournamentStartTime
      const remaining = Math.max(0, tournamentDuration - elapsed)
      setTimeRemaining(remaining)

      if (remaining === 0 && !waitingForFinalResults) {
        onExpire()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isActive, tournamentStartTime, tournamentDuration, waitingForFinalResults])

  const minutes = Math.floor(timeRemaining / 60000)
  const seconds = Math.floor((timeRemaining % 60000) / 1000)
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`

  return { timeRemaining, setTimeRemaining, formattedTime }
}
