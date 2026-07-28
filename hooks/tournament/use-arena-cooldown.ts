"use client"

import { useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"
import { logArenaPairing } from "@/lib/pairing/arena-pairing-debug"
import { isArenaT1Eligible, setArenaCooldownReductions } from "@/lib/pairing/arena-t1"
import { collectPairingInputs } from "@/lib/tournament/collect-pairing-inputs"
import type { ArenaState } from "@/lib/types"
import type { useI18n } from "@/components/i18n-provider"

type TFunction = ReturnType<typeof useI18n>["t"]

type UseArenaCooldownOptions = {
  arenaState: ArenaState
  isOrganizer: boolean
  waitingForFinalResults: boolean
  hasVenue: boolean
  t: TFunction
}

/**
 * Organizer T1 cooldown reductions for balanced-strength arenas.
 */
export function useArenaCooldown({
  arenaState,
  isOrganizer,
  waitingForFinalResults,
  hasVenue,
  t,
}: UseArenaCooldownOptions) {
  const arenaStateRef = useRef(arenaState)
  arenaStateRef.current = arenaState
  const cooldownReductionMsByPlayerIdRef = useRef<Record<string, number>>({})

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

  const handleReduceWaitOneMinute = useCallback(() => {
    if (!isOrganizer || !arenaState.isActive || waitingForFinalResults) return
    if ((arenaState.settings.pairingAlgorithm || "all-vs-all") !== "balanced-strength") return

    const state = arenaStateRef.current
    const { availablePlayers, matchesForPairing } = collectPairingInputs(state, hasVenue)
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
    hasVenue,
    isOrganizer,
    t,
    waitingForFinalResults,
  ])

  return { handleReduceWaitOneMinute }
}
