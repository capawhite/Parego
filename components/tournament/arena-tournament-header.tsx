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
import { TournamentShareDialog } from "@/components/tournament/tournament-share-dialog"

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
    <div className="sticky top-10 z-40 -mx-4 px-4 py-2.5 mb-3 bg-background/95 backdrop-blur-md border-b border-border supports-[backdrop-filter]:bg-background/85 shadow-sm">
      <div className="flex flex-col gap-2.5">
        {/* Title row — never shares horizontal space with tabs */}
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <h1
              className="text-lg sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground leading-tight line-clamp-2 min-w-0 flex-1"
              title={displayName}
            >
              {displayName}
            </h1>
            <div className="flex items-center gap-1 shrink-0">
              {tournamentId && tournamentStatus !== "completed" && isOrganizer && (
                <TournamentShareDialog
                  tournamentId={tournamentId}
                  tournamentName={displayName}
                />
              )}
              {tournamentId &&
                tournamentStatus !== "completed" &&
                !isOrganizer &&
                !isCurrentUserInTournament && (
                  <Button variant="default" size="sm" className="shrink-0 h-9 gap-1.5" asChild>
                    <Link href={`/join/${tournamentId}`}>
                      <LogIn className="h-4 w-4" />
                      <span className="hidden sm:inline">{t("tournamentHeader.joinButton")}</span>
                    </Link>
                  </Button>
                )}
              <Link href="/">
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={t("home.homeLink")}>
                  <Home className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
            <Badge variant="secondary" className="font-normal text-xs">
              {userRole === "organizer"
                ? t("tournamentHeader.roleOrganizer")
                : userRole === "registered-player" || userRole === "guest-player"
                  ? t("tournamentHeader.rolePlayer")
                  : t("tournamentHeader.roleVisitor")}
            </Badge>
            {organizerName && (
              <p className="text-xs sm:text-sm text-muted-foreground truncate max-w-full">
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
              className="inline-flex items-center gap-1 text-xs sm:text-sm text-primary hover:underline mt-0.5"
            >
              <MapPin className="h-3.5 w-3.5" />
              {t("tournamentHeader.getDirections")}
            </a>
          )}
          {tournamentStatus === "completed" && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{t("tournamentHeader.statusCompleted")}</p>
          )}
        </div>

        {/* Tabs always full-width so they never disappear behind the title */}
        <TabsList
          className={`grid h-auto w-full min-h-11 ${
            tabCount === 3
              ? "grid-cols-3"
              : tabCount === 5
                ? "grid-cols-3 sm:grid-cols-5"
                : "grid-cols-2 sm:grid-cols-4"
          }`}
        >
          <TabsTrigger value="players" className="text-[11px] sm:text-sm min-h-11 px-1 sm:px-3 gap-0.5">
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="truncate">{t("tournamentHeader.playersTab")}</span>
          </TabsTrigger>
          <TabsTrigger value="pairings" className="relative text-[11px] sm:text-sm min-h-11 px-1 sm:px-3 gap-0.5">
            <Swords className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="truncate">{t("tournamentHeader.pairingsTab")}</span>
            {pairingsConflict && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
            )}
          </TabsTrigger>
          {showPairingStatusTab && tournamentStatus !== "completed" && (
            <TabsTrigger value="pairingStatus" className="text-[11px] sm:text-sm min-h-11 px-1 sm:px-3 gap-0.5">
              <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">{t("tournamentHeader.pairingStatusTab")}</span>
            </TabsTrigger>
          )}
          {tournamentStatus !== "completed" && (
            <TabsTrigger value="results" className="relative text-[11px] sm:text-sm min-h-11 px-1 sm:px-3 gap-0.5">
              <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">{t("tournamentHeader.resultsTab")}</span>
              {resultsConflict ? (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
              ) : hasNewPairing || hasAnySubmission ? (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
              ) : null}
            </TabsTrigger>
          )}
          <TabsTrigger value="standings" className="text-[11px] sm:text-sm min-h-11 px-1 sm:px-3 gap-0.5">
            <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="truncate">{t("tournamentHeader.standingsTab")}</span>
          </TabsTrigger>
        </TabsList>

        {/* Actions row — compact on mobile */}
        {(arenaIsActive || canAccessSettings) && (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {arenaIsActive && (
              <>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 rounded-md">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-semibold text-primary tabular-nums">{timeRemainingFormatted}</span>
                </div>
                {isOrganizer && pairingAlgorithm === "all-vs-all" && (
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-md">
                    <span className="text-xs text-muted-foreground">
                      {t("arena.allVsAllCompletionLabel")}:{" "}
                      <span className="font-semibold text-foreground">{Math.round(completionRatio * 100)}%</span>
                    </span>
                  </div>
                )}
                {isOrganizer && pairingAlgorithm === "all-vs-all" && completionRatio >= 1 && (
                  <p className="text-xs text-muted-foreground w-full sm:w-auto sm:max-w-[220px] hidden sm:block">
                    {t("arena.allUniquePairingsCompleteMessage")}
                  </p>
                )}
                {tournamentStatus === "active" && canEndTournament && (
                  <Button variant="destructive" size="sm" className="h-8" onClick={onEndTournament}>
                    {t("tournamentHeader.endTournamentButton")}
                  </Button>
                )}
              </>
            )}
            {canAccessSettings && (
              <div className="ml-auto flex items-center gap-1.5">
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
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
