"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MapPin, Clock, Eye, LogIn, Heart, Loader2, ExternalLink } from "lucide-react"
import Link from "next/link"
import type { TournamentData } from "@/lib/database/tournament-db"
import { cn } from "@/lib/utils"

type DisplayStatus = "live" | "starting_soon" | "upcoming"

function getDisplayStatus(t: TournamentData): DisplayStatus {
  if (t.status === "active") return "live"
  if (!t.start_time) return "upcoming"
  const start = new Date(t.start_time).getTime()
  const now = Date.now()
  const inOneHour = 60 * 60 * 1000
  if (start <= now + inOneHour) return "starting_soon"
  return "upcoming"
}

function formatStartTime(startTime?: string): string {
  if (!startTime) return "Start time TBD"
  const date = new Date(startTime)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 0) return "Started"
  if (diffMins < 60) return `starts in ${diffMins} min`
  if (diffMins < 1440) return `starts in ${Math.floor(diffMins / 60)} hr`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

/** Google Maps URL for venue (view or directions). */
function googleMapsUrl(lat: number, lon: number, mode: "place" | "directions" = "place"): string {
  if (mode === "directions") {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
  }
  return `https://www.google.com/maps?q=${lat},${lon}`
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

interface LandingTournamentCardProps {
  tournament: TournamentData
  userCoords?: { lat: number; lon: number } | null
  showDistance?: boolean
  /** Number of users who expressed interest */
  interestCount?: number
  /** Number of players currently in the tournament */
  playerCount?: number
  /** First few player names for preview (e.g. first 5) */
  playerNames?: string[]
  /** Whether current user has expressed interest */
  userInterested?: boolean
  /** Callback when user toggles interest (requires sign-in). Omit or not provided when not logged in. */
  onToggleInterest?: (tournamentId: string) => Promise<void>
  /** Whether a toggle request is in progress */
  togglingInterest?: boolean
  className?: string
}

export function LandingTournamentCard({
  tournament,
  userCoords,
  showDistance = true,
  interestCount = 0,
  playerCount = 0,
  playerNames = [],
  userInterested = false,
  onToggleInterest,
  togglingInterest = false,
  className,
}: LandingTournamentCardProps) {
  const canToggle = typeof onToggleInterest === "function"
  const displayStatus = getDisplayStatus(tournament)
  const distance =
    showDistance && userCoords && tournament.latitude != null && tournament.longitude != null
      ? haversineKm(userCoords.lat, userCoords.lon, tournament.latitude, tournament.longitude)
      : null

  const statusLabel = {
    live: "Live",
    starting_soon: "Starting soon",
    upcoming: "Upcoming",
  }[displayStatus]

  const statusClass = {
    live: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    starting_soon: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    upcoming: "bg-primary/15 text-primary border-primary/30",
  }[displayStatus]

  return (
    <Card
      className={cn(
        "overflow-hidden border-2 transition-all duration-200 hover:border-primary/40 hover:shadow-md h-full flex flex-col",
        className
      )}
    >
      <CardContent className="p-0 flex flex-col flex-1">
        <div className="p-4 space-y-3 flex-1">
          <Link href={`/tournament/${tournament.id}`} className="block">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-lg leading-tight truncate flex-1 min-w-0">
                {tournament.name}
              </h3>
              <span
                className={cn(
                  "flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded border",
                  statusClass
                )}
              >
                {statusLabel}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {tournament.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {tournament.city}
                  {tournament.country ? `, ${tournament.country}` : ""}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatStartTime(tournament.start_time)}
              </span>
              {distance != null && (
                <span className="text-primary font-medium">{formatDistance(distance)} from you</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              {playerCount > 0 && (
                <span>
                  <span className="font-medium text-foreground">
                    {playerCount} {playerCount === 1 ? "player" : "players"}
                  </span>
                  {playerNames.length > 0 && (
                    <span className="text-muted-foreground ml-1 min-w-0 truncate block sm:inline" title={playerNames.slice(0, 5).join(", ") + (playerCount > 5 ? ` +${playerCount - 5} more` : "")}>
                      — {playerNames.slice(0, 5).join(", ")}
                      {playerCount > 5 ? ` +${playerCount - 5} more` : ""}
                    </span>
                  )}
                </span>
              )}
              {interestCount > 0 && (
                <span>
                  {interestCount} {interestCount === 1 ? "person" : "people"} interested
                </span>
              )}
            </div>
          </Link>
          {tournament.latitude != null && tournament.longitude != null && (
            <a
              href={googleMapsUrl(tournament.latitude, tournament.longitude, "directions")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Get directions
            </a>
          )}
        </div>
        <div className="flex border-t bg-muted/30 min-h-[44px]">
          {canToggle ? (
            <Button
              variant="ghost"
              size="sm"
              className={cn("flex-1 rounded-none min-h-[44px] touch-manipulation", userInterested && "text-primary")}
              onClick={(e) => {
                e.preventDefault()
                onToggleInterest?.(tournament.id)
              }}
              disabled={togglingInterest}
            >
              {togglingInterest ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Heart
                  className={cn("h-4 w-4 mr-2", userInterested && "fill-current")}
                />
              )}
              {userInterested ? "Interested" : "Interest"}
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" className="flex-1 rounded-none min-h-[44px] touch-manipulation" asChild>
            <Link href={`/tournament/${tournament.id}`}>
              <Eye className="h-4 w-4 mr-2 shrink-0" />
              View
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 rounded-none min-h-[44px] touch-manipulation" asChild>
            <Link href={`/join/${tournament.id}`}>
              <LogIn className="h-4 w-4 mr-2 shrink-0" />
              Join
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
