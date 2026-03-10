"use client"

import { useState, useEffect } from "react"
import {
  getGuestSessionHistory,
  getConversionPromptDismissed,
  type GuestSessionEntry,
} from "@/lib/guest-session-history"
import type { ConversionTrigger } from "@/components/conversion-prompt"

type UserRole = "organizer" | "registered-player" | "guest-player" | "visitor"

export interface ConversionPromptsResult {
  pastGuestSessions: GuestSessionEntry[]
  showConversionPrompt: ConversionTrigger | null
  setShowConversionPrompt: React.Dispatch<React.SetStateAction<ConversionTrigger | null>>
}

export function useConversionPrompts(
  isLoading: boolean,
  userRole: UserRole,
  guestHasMatch: boolean | string | undefined,
  tournamentUsesRatings: boolean,
): ConversionPromptsResult {
  const [pastGuestSessions, setPastGuestSessions] = useState<GuestSessionEntry[]>([])
  const [showConversionPrompt, setShowConversionPrompt] = useState<ConversionTrigger | null>(null)

  // Load guest session history on mount
  useEffect(() => {
    setPastGuestSessions(getGuestSessionHistory())
  }, [])

  // Trigger 1: Repeat play — guest/visitor with past sessions
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

  // Trigger 3: Rated game — guest is paired in a ratings-based tournament
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

  return { pastGuestSessions, showConversionPrompt, setShowConversionPrompt }
}
