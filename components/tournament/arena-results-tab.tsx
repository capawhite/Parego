"use client"

import { Card, CardContent } from "@/components/ui/card"
import { CurrentRound } from "@/components/current-round"
import { TournamentSimulatorPanel } from "@/components/tournament-simulator-panel"
import type { Match, Player } from "@/lib/types"
import { useI18n } from "@/components/i18n-provider"

export interface ArenaResultsTabProps {
  tournamentStatus: "setup" | "active" | "completed"
  isActive: boolean
  pairedMatches: Match[]
  players: Player[]
  effectivePlayerView: boolean
  showSimulator: boolean
  playerSession?: { playerId: string; role: "player" | "organizer" }
  canRecordResults: boolean
  onRecordResult: (matchId: string, winnerId?: string, isDraw?: boolean) => void
  onPlayerSubmit: (matchId: string, result: "player1-win" | "draw" | "player2-win") => void
  onPlayerConfirm: (matchId: string, result?: "player1-win" | "draw" | "player2-win") => void
  onPlayerCancel: (matchId: string) => void
}

export function ArenaResultsTab({
  tournamentStatus,
  isActive,
  pairedMatches,
  players,
  effectivePlayerView,
  showSimulator,
  playerSession,
  canRecordResults,
  onRecordResult,
  onPlayerSubmit,
  onPlayerConfirm,
  onPlayerCancel,
}: ArenaResultsTabProps) {
  const { t } = useI18n()

  if (tournamentStatus === "completed") {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">{t("results.tournamentEndedNoResults")}</p>
        </CardContent>
      </Card>
    )
  }

  const isPlayer = playerSession?.role === "player"
  const roundProps = {
    matches: pairedMatches,
    onRecordResult,
    playerSession,
    onPlayerSubmit,
    onPlayerConfirm,
    onPlayerCancel,
    canRecordResults,
    allPlayers: players,
  } as const

  return (
    <>
      {!effectivePlayerView && isActive && showSimulator && (
        <div className="mb-4">
          <TournamentSimulatorPanel />
        </div>
      )}
      {isPlayer ? (
        <CurrentRound {...roundProps} />
      ) : pairedMatches.length > 0 ? (
        <div className="space-y-4">
          <CurrentRound {...roundProps} />
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              {isActive ? t("results.morePairingsComingSoon") : t("results.noMatchesYet")}
            </p>
          </CardContent>
        </Card>
      )}
    </>
  )
}
