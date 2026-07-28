"use client"

import { useEffect, type Dispatch, type SetStateAction } from "react"
import { loadPlayers } from "@/lib/database/tournament-db"
import type { ArenaState } from "@/lib/types"

const DEBUG = process.env.NODE_ENV === "development"

type UseArenaPlayersRefreshOptions = {
  tournamentId: string | null
  status: ArenaState["status"]
  activeTab: string
  isLoading: boolean
  setArenaState: Dispatch<SetStateAction<ArenaState>>
}

/** Refresh roster when organizer opens the Players tab (and poll while still loading). */
export function useArenaPlayersRefresh({
  tournamentId,
  status,
  activeTab,
  isLoading,
  setArenaState,
}: UseArenaPlayersRefreshOptions): void {
  useEffect(() => {
    if (!tournamentId || status === "completed" || activeTab !== "players") return

    const refreshPlayers = async () => {
      try {
        const dbPlayers = await loadPlayers(tournamentId)
        setArenaState((prev) => {
          const existingPlayerIds = new Set(prev.players.map((p) => p.id))
          const newPlayers = dbPlayers.filter((p) => !existingPlayerIds.has(p.id))
          if (newPlayers.length === 0) return prev
          if (DEBUG) console.log("[v0] New players joined:", newPlayers.map((p) => p.name))
          return { ...prev, players: [...prev.players, ...newPlayers] }
        })
      } catch (error) {
        console.error("[v0] Error refreshing players:", error)
      }
    }

    void refreshPlayers()

    if (isLoading) {
      const interval = setInterval(refreshPlayers, 5000)
      return () => clearInterval(interval)
    }
  }, [tournamentId, status, activeTab, isLoading, setArenaState])
}
