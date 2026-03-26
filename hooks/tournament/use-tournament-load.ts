"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  loadTournament,
  loadPlayers,
  loadMatches,
  getAvatarUrls,
} from "@/lib/database/tournament-db"
import type { ArenaState, Player, TournamentSettings } from "@/lib/types"
import { DEFAULT_SETTINGS } from "@/lib/types"
import { effectiveTableCountFromDb } from "@/lib/tournament/effective-table-count"

const TOURNAMENT_DURATION = 60 * 60 * 1000
const DEBUG = process.env.NODE_ENV === "development"

export interface TournamentMetadata {
  city?: string
  country?: string
  latitude?: number
  longitude?: number
  visibility?: "public" | "private"
}

export interface TournamentLoadResult {
  arenaState: ArenaState
  setArenaState: React.Dispatch<React.SetStateAction<ArenaState>>
  isLoading: boolean
  currentUserId: string | null
  organizerId: string | null
  organizerName: string | null
  tournamentMetadata: TournamentMetadata | null
  currentPlayerInTournament: Player | null
  setCurrentPlayerInTournament: React.Dispatch<React.SetStateAction<Player | null>>
  userName: string
  userRating: number | null
  userRatingBand: string | null
  userCountry: string | null
}

export function useTournamentLoad(tournamentId: string | null): TournamentLoadResult {
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
    status: "setup",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [organizerId, setOrganizerId] = useState<string | null>(null)
  const [organizerName, setOrganizerName] = useState<string | null>(null)
  const [tournamentMetadata, setTournamentMetadata] = useState<TournamentMetadata | null>(null)
  const [currentPlayerInTournament, setCurrentPlayerInTournament] = useState<Player | null>(null)
  const [userName, setUserName] = useState("")
  const [userRating, setUserRating] = useState<number | null>(null)
  const [userRatingBand, setUserRatingBand] = useState<string | null>(null)
  const [userCountry, setUserCountry] = useState<string | null>(null)

  useEffect(() => {
    const loadFromDatabase = async () => {
      if (!tournamentId) return

      if (DEBUG) console.log("[arena] Loading tournament:", tournamentId)

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
        if (DEBUG) console.log("[arena] Found tournament:", tournament.name, "status:", tournament.status)

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

        const activeMatches = dbMatches.filter((m) => !m.result?.completed)
        const completedMatches = dbMatches.filter((m) => m.result?.completed)

        if (DEBUG)
          console.log(
            "[arena] Loaded",
            dbPlayers.length,
            "players,",
            activeMatches.length,
            "active,",
            completedMatches.length,
            "completed matches",
          )

        if (user) {
          const playerMatch = dbPlayers.find((p) => p.userId === user.id)
          setCurrentPlayerInTournament(playerMatch || null)
        }

        const userIds = dbPlayers.map((p) => p.userId).filter((id): id is string => !!id)
        const avatarUrls = userIds.length > 0 ? await getAvatarUrls(userIds) : {}
        const enrichedPlayers = dbPlayers.map((p) =>
          p.userId && avatarUrls[p.userId]
            ? { ...p, avatarUrl: avatarUrls[p.userId] }
            : { ...p, avatarUrl: null },
        )

        const startTimeMs = tournament.start_time
          ? new Date(tournament.start_time).getTime()
          : null

        const savedSettings =
          tournament.settings && typeof tournament.settings === "object"
            ? (tournament.settings as TournamentSettings)
            : {}
        const resolvedTables = effectiveTableCountFromDb({
          tables_count: tournament.tables_count,
          settings: savedSettings,
          status: tournament.status,
        })

        setArenaState((prev) => ({
          ...prev,
          players: enrichedPlayers.length > 0 ? enrichedPlayers : prev.players,
          tableCount: resolvedTables,
          settings: {
            ...DEFAULT_SETTINGS,
            ...savedSettings,
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
        if (DEBUG) console.log("[arena] Tournament not found, initializing fresh state")
        setArenaState((prev) => ({ ...prev, status: "setup" }))
      }

      setIsLoading(false)
    }

    loadFromDatabase()
  }, [tournamentId])

  return {
    arenaState,
    setArenaState,
    isLoading,
    currentUserId,
    organizerId,
    organizerName,
    tournamentMetadata,
    currentPlayerInTournament,
    setCurrentPlayerInTournament,
    userName,
    userRating,
    userRatingBand,
    userCountry,
  }
}
