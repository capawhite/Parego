"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Users,
  Swords,
  Trophy,
  Award,
  Clock,
  Home,
  SettingsIcon,
  MapPin,
} from "lucide-react"
import Link from "next/link"
import type { TournamentMetadata } from "@/hooks/tournament/use-tournament-load"
import { useI18n } from "@/components/i18n-provider"

type UserRole = "organizer" | "registered-player" | "guest-player" | "visitor"

interface TournamentHeaderProps {
  displayName: string
  userRole: UserRole
  organizerName: string | null
  isOrganizer: boolean
  isActive: boolean
  status: "setup" | "active" | "completed"
  formattedTime: string
  effectivePlayerView: boolean
  activeTab: string
  tournamentMetadata: TournamentMetadata | null
  canEndTournament: boolean
  canAccessSettings: boolean
  hasNewPairing?: boolean
  onEndTournament: () => void
  onOpenSettings: () => void
}

export function TournamentHeader({
  displayName,
  userRole,
  organizerName,
  isOrganizer,
  isActive,
  status,
  formattedTime,
  effectivePlayerView,
  activeTab,
  tournamentMetadata,
  canEndTournament,
  canAccessSettings,
  hasNewPairing = false,
  onEndTournament,
  onOpenSettings,
}: TournamentHeaderProps) {
  const { t } = useI18n()

  const roleLabel =
    userRole === "organizer"
      ? t("tournamentHeader.roleOrganizer")
      : userRole === "registered-player" || userRole === "guest-player"
        ? t("tournamentHeader.rolePlayer")
        : t("tournamentHeader.roleVisitor")

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 mb-1">
          <h1 className="text-xl sm:text-2xl font-bold truncate">{displayName}</h1>
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8 shrink-0">
              <Home className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <Badge variant="secondary" className="font-normal">
            {roleLabel}
          </Badge>
          {organizerName && (
            <p className="text-sm text-muted-foreground">
              {t("tournamentHeader.organizedBy", { name: organizerName })}
              {isOrganizer && <span className="text-primary ml-1">{t("tournamentHeader.organizedByYou")}</span>}
            </p>
          )}
        </div>
        {tournamentMetadata?.latitude != null && tournamentMetadata?.longitude != null && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${tournamentMetadata.latitude},${tournamentMetadata.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-1"
          >
            <MapPin className="h-4 w-4" />
            {t("tournamentHeader.getDirections")}
          </a>
        )}
        {status === "completed" && (
          <p className="text-sm text-muted-foreground mt-1">{t("tournamentHeader.statusCompleted")}</p>
        )}
      </div>

      <TabsList
        className={`grid h-auto w-full sm:w-auto min-h-[44px] ${
          effectivePlayerView
            ? status !== "completed" ? "grid-cols-3" : "grid-cols-2"
            : status !== "completed" ? "grid-cols-4" : "grid-cols-3"
        }`}
      >
        {!effectivePlayerView && (
          <TabsTrigger value="players" className="text-xs sm:text-sm min-h-[44px] px-2 sm:px-3">
            <Users className="h-4 w-4 mr-1" />
            {t("tournamentHeader.playersTab")}
          </TabsTrigger>
        )}
        <TabsTrigger value="pairings" className="text-xs sm:text-sm min-h-[44px] px-2 sm:px-3">
          <Swords className="h-4 w-4 mr-1" />
          {t("tournamentHeader.pairingsTab")}
        </TabsTrigger>
        {status !== "completed" && (
          <TabsTrigger value="results" className="relative text-xs sm:text-sm min-h-[44px] px-2 sm:px-3">
            <Trophy className="h-4 w-4 mr-1" />
            {t("tournamentHeader.resultsTab")}
            {hasNewPairing && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </TabsTrigger>
        )}
        <TabsTrigger value="standings" className="text-xs sm:text-sm min-h-[44px] px-2 sm:px-3">
          <Award className="h-4 w-4 mr-1" />
          {t("tournamentHeader.standingsTab")}
        </TabsTrigger>
      </TabsList>

      {isActive && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-md">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">{formattedTime}</span>
          </div>
          {status === "active" && canEndTournament && (
            <Button variant="destructive" size="sm" onClick={onEndTournament}>
              {t("tournamentHeader.endTournamentButton")}
            </Button>
          )}
        </div>
      )}

      {canAccessSettings && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0 bg-transparent"
          onClick={onOpenSettings}
          title={t("tournamentHeader.settingsTooltip")}
        >
          <SettingsIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
