"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Match } from "@/lib/types"
import {
  Award,
  ClipboardList,
  Clock,
  Home,
  LogIn,
  MapPin,
  SettingsIcon,
  Swords,
  Trash2,
  Trophy,
  Users,
} from "lucide-react"
import { useI18n } from "@/components/i18n-provider"

export type ArenaHeaderUserRole = "organizer" | "registered-player" | "guest-player" | "visitor"

function hasSubmissionConflict(matches: Match[]) {
  return matches.some(
    (m) =>
      m.player1Submission?.confirmed &&
      m.player2Submission?.confirmed &&
      m.player1Submission.result !== m.player2Submission.result,
  )
}

export interface ArenaTournamentHeaderProps {
  displayName: string
  tournamentId: string | null
  isCurrentUserInTournament: boolean
  userRole: ArenaHeaderUserRole
  organizerName: string | null
  isOrganizer: boolean
  tournamentMetadata: { latitude?: number; longitude?: number } | null
  tournamentStatus: "setup" | "active" | "completed"
  arenaIsActive: boolean
  pairedMatches: Match[]
  pairingAlgorithm?: string
  hasNewPairing: boolean
  timeRemainingFormatted: string
  completionRatio: number
  canEndTournament: boolean
  canAccessSettings: boolean
  /** Organizer-only tab while the arena clock is running */
  showPairingStatusTab?: boolean
  onEndTournament: () => void
  onOpenDeleteDialog: () => void
  onOpenSettings: () => void
}

export function ArenaTournamentHeader({
  displayName,
  tournamentId,
  isCurrentUserInTournament,
  userRole,
  organizerName,
  isOrganizer,
  tournamentMetadata,
  tournamentStatus,
  arenaIsActive,
  pairedMatches,
  pairingAlgorithm,
  hasNewPairing,
  timeRemainingFormatted,
  completionRatio,
  canEndTournament,
  canAccessSettings,
  showPairingStatusTab = false,
  onEndTournament,
  onOpenDeleteDialog,
  onOpenSettings,
}: ArenaTournamentHeaderProps) {
  const { t } = useI18n()

  const tabCount =
    tournamentStatus === "completed"
      ? 3
      : showPairingStatusTab
        ? 5
        : 4

  const pairingsConflict = hasSubmissionConflict(pairedMatches)
  const resultsConflict = pairingsConflict
  const hasAnySubmission = pairedMatches.some(
    (m) => m.player1Submission?.confirmed || m.player2Submission?.confirmed,
  )

  return (
    <div className="sticky top-0 z-40 -mx-4 px-4 py-3 mb-4 bg-background/95 backdrop-blur-md border-b border-border supports-[backdrop-filter]:bg-background/85 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex-1 min-w-0 basis-full sm:basis-0 sm:min-w-[12rem]">
        <div className="flex items-start sm:items-center gap-2 sm:gap-3 mb-1">
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight line-clamp-2 sm:line-clamp-2 min-w-0 flex-1"
            title={displayName}
          >
            {displayName}
          </h1>
          <div className="flex items-center gap-1 shrink-0 pt-0.5 sm:pt-0">
            {tournamentId && tournamentStatus !== "completed" && !isCurrentUserInTournament && (
              <Button variant="default" size="sm" className="shrink-0 h-9 gap-1.5" asChild>
                <Link href={`/join/${tournamentId}`}>
                  <LogIn className="h-4 w-4" />
                  {t("tournamentHeader.joinButton")}
                </Link>
              </Button>
            )}
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8 shrink-0">
                <Home className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <Badge variant="secondary" className="font-normal">
            {userRole === "organizer"
              ? t("tournamentHeader.roleOrganizer")
              : userRole === "registered-player" || userRole === "guest-player"
                ? t("tournamentHeader.rolePlayer")
                : t("tournamentHeader.roleVisitor")}
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
        {tournamentStatus === "completed" && (
          <p className="text-sm text-muted-foreground mt-1">{t("tournamentHeader.statusCompleted")}</p>
        )}
      </div>

      <TabsList
        className={`grid h-auto w-full sm:w-auto min-h-[44px] ${
          tabCount === 3
            ? "grid-cols-3"
            : tabCount === 5
              ? "grid-cols-2 sm:grid-cols-5"
              : "grid-cols-2 sm:grid-cols-4"
        }`}
      >
        <TabsTrigger value="players" className="text-xs sm:text-sm min-h-[44px] px-2 sm:px-3">
          <Users className="h-4 w-4 mr-1" />
          {t("tournamentHeader.playersTab")}
        </TabsTrigger>
        <TabsTrigger value="pairings" className="relative text-xs sm:text-sm min-h-[44px] px-2 sm:px-3">
          <Swords className="h-4 w-4 mr-1" />
          {t("tournamentHeader.pairingsTab")}
          {pairingsConflict && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          )}
        </TabsTrigger>
        {showPairingStatusTab && tournamentStatus !== "completed" && (
          <TabsTrigger value="pairingStatus" className="text-xs sm:text-sm min-h-[44px] px-2 sm:px-3">
            <ClipboardList className="h-4 w-4 mr-1 shrink-0" />
            {t("tournamentHeader.pairingStatusTab")}
          </TabsTrigger>
        )}
        {tournamentStatus !== "completed" && (
          <TabsTrigger value="results" className="relative text-xs sm:text-sm min-h-[44px] px-2 sm:px-3">
            <Trophy className="h-4 w-4 mr-1" />
            {t("tournamentHeader.resultsTab")}
            {resultsConflict ? (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            ) : hasNewPairing || hasAnySubmission ? (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            ) : null}
          </TabsTrigger>
        )}
        <TabsTrigger value="standings" className="text-xs sm:text-sm min-h-[44px] px-2 sm:px-3">
          <Award className="h-4 w-4 mr-1" />
          {t("tournamentHeader.standingsTab")}
        </TabsTrigger>
      </TabsList>

      {arenaIsActive && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-md">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-primary">{timeRemainingFormatted}</span>
          </div>
          {isOrganizer && pairingAlgorithm === "all-vs-all" && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-md">
              <span className="text-xs text-muted-foreground">
                {t("arena.allVsAllCompletionLabel")}:{" "}
                <span className="font-semibold text-foreground">{Math.round(completionRatio * 100)}%</span>
              </span>
            </div>
          )}
          {isOrganizer && pairingAlgorithm === "all-vs-all" && completionRatio >= 1 && (
            <p className="text-xs text-muted-foreground w-full sm:w-auto sm:max-w-[220px]">
              {t("arena.allUniquePairingsCompleteMessage")}
            </p>
          )}
          {tournamentStatus === "active" && canEndTournament && (
            <Button variant="destructive" size="sm" onClick={onEndTournament}>
              {t("tournamentHeader.endTournamentButton")}
            </Button>
          )}
        </div>
      )}

      {canAccessSettings && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 bg-transparent text-muted-foreground hover:text-destructive hover:border-destructive/50"
            onClick={onOpenDeleteDialog}
            title={t("tournamentHeader.deleteTournamentButton")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 bg-transparent"
            onClick={onOpenSettings}
            title={t("tournamentHeader.settingsTooltip")}
          >
            <SettingsIcon className="h-4 w-4" />
          </Button>
        </>
      )}
      </div>
    </div>
  )
}
