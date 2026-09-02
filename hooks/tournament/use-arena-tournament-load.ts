"use client"

import { useEffect, type Dispatch, type SetStateAction } from "react"
import { createClient } from "@/lib/supabase/client"
import { fetchTournamentById } from "@/app/actions/join-tournament"
import { getAvatarUrls, loadMatches, loadPlayers } from "@/lib/database/tournament-db"
import { parseTournamentSettings } from "@/lib/tournament-settings"
import { effectiveTableCountFromDb } from "@/lib/tournament/effective-table-count"
import type { FideRatings } from "@/lib/fide/types"
import type { ArenaState, Player } from "@/lib/types"

const DEBUG = process.env.NODE_ENV === "development"

type TournamentMetadata = {
  city?: string
  country?: string
  latitude?: number
  longitude?: number
  visibility?: "public" | "private"
}

type UseArenaTournamentLoadOptions = {
  tournamentId: string | null
  tournamentDurationMs: number
  setArenaState: Dispatch<SetStateAction<ArenaState>>
  setIsLoading: Dispatch<SetStateAction<boolean>>
  setCurrentUserId: Dispatch<SetStateAction<string | null>>
  setUserName: Dispatch<SetStateAction<string>>
  setUserRating: Dispatch<SetStateAction<number | null>>
  setUserRatingBand: Dispatch<SetStateAction<string | null>>
  setUserFideRatings: Dispatch<SetStateAction<FideRatings | null>>
  setUserFederation: Dispatch<SetStateAction<string | null>>
  setUserCountry: Dispatch<SetStateAction<string | null>>
  setDisplayName: Dispatch<SetStateAction<string>>
  setOrganizerId: Dispatch<SetStateAction<string | null>>
  setOrganizerName: Dispatch<SetStateAction<string | null>>
  setTournamentMetadata: Dispatch<SetStateAction<TournamentMetadata | null>>
  setCurrentPlayerInTournament: Dispatch<SetStateAction<Player | null>>
}

/**
 * Initial tournament + auth profile load for ArenaPanel.
 */
export function useArenaTournamentLoad({
  tournamentId,
  tournamentDurationMs,
  setArenaState,
  setIsLoading,
  setCurrentUserId,
  setUserName,
  setUserRating,
  setUserRatingBand,
  setUserFideRatings,
  setUserFederation,
  setUserCountry,
  setDisplayName,
  setOrganizerId,
  setOrganizerName,
  setTournamentMetadata,
  setCurrentPlayerInTournament,
}: UseArenaTournamentLoadOptions): void {
  useEffect(() => {
    const loadFromDatabase = async () => {
      if (!tournamentId) return

      if (DEBUG) console.log("[v0] Loading tournament from database:", tournamentId)

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        const { data: profileData } = await supabase
          .from("users")
          .select("name, rating, rating_band, country, federation, fide_standard, fide_rapid, fide_blitz")
          .eq("id", user.id)
          .maybeSingle()
        if (profileData) {
          setUserName(profileData.name || "")
          setUserRating(profileData.rating ?? null)
          setUserRatingBand(profileData.rating_band ?? null)
          setUserFideRatings({
            standard: profileData.fide_standard ?? null,
            rapid: profileData.fide_rapid ?? null,
            blitz: profileData.fide_blitz ?? null,
          })
          setUserFederation(profileData.federation || null)
          setUserCountry(profileData.country || null)
        }
      }

      const tournament = await fetchTournamentById(tournamentId)
      if (tournament) {
        if (DEBUG) console.log("[v0] Found tournament:", tournament.name, "Status:", tournament.status)

        if (tournament.name?.trim()) {
          setDisplayName(tournament.name.trim())
        }

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

        if (DEBUG) {
          console.log(
            "[v0] Loaded",
            dbPlayers.length,
            "players,",
            activeMatches.length,
            "active matches,",
            completedMatches.length,
            "completed matches",
          )
        }

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

        const startTimeMs = tournament.start_time ? new Date(tournament.start_time).getTime() : null

        const validatedSettings = parseTournamentSettings(tournament)
        const resolvedTables = effectiveTableCountFromDb({
          tables_count: tournament.tables_count,
          settings: validatedSettings,
          status: tournament.status,
        })

        setArenaState((prev) => ({
          ...prev,
          players: enrichedPlayers.length > 0 ? enrichedPlayers : prev.players,
          tableCount: resolvedTables,
          settings: {
            ...validatedSettings,
            tableCount: resolvedTables,
          },
          status: tournament.status,
          isActive: tournament.status === "active",
          pairedMatches: activeMatches,
          allTimeMatches: completedMatches,
          tournamentDuration: tournamentDurationMs,
          tournamentStartTime: startTimeMs,
        }))
      } else {
        if (DEBUG) console.log("[v0] Tournament not found, initializing fresh state")
        setArenaState((prev) => ({
          ...prev,
          status: "setup",
        }))
      }

      setIsLoading(false)
    }

    void loadFromDatabase()
  }, [
    tournamentId,
    tournamentDurationMs,
    setArenaState,
    setIsLoading,
    setCurrentUserId,
    setUserName,
    setUserRating,
    setUserRatingBand,
    setUserFideRatings,
    setUserFederation,
    setUserCountry,
    setDisplayName,
    setOrganizerId,
    setOrganizerName,
    setTournamentMetadata,
    setCurrentPlayerInTournament,
  ])
}
