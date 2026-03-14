"use client"

import { Card, CardContent } from "@/components/ui/card"
import { CurrentRound } from "@/components/current-round"
import { TournamentSimulatorPanel } from "@/components/tournament-simulator-panel"
import { useI18n } from "@/components/i18n-provider"
import type { Match, Player } from "@/lib/types"
import type { ArenaSessionData } from "@/hooks/tournament/use-player-session"

interface ResultsTabProps {
  status: "setup" | "active" | "completed"
  isActive: boolean
  pairedMatches: Match[]
  players: Player[]
  effectivePlayerView: boolean
  showSimulator: boolean
  playerSession: ArenaSessionData | null
  canRecordResults: boolean
  onRecordResult: (matchId: string, winnerId?: string, isDraw?: boolean) => void
  onPlayerSubmit: (matchId: string, result: "player1-win" | "draw" | "player2-win") => void
  onPlayerConfirm: (matchId: string, result: "player1-win" | "draw" | "player2-win") => void
  onPlayerCancel: (matchId: string) => void
}

export function ResultsTab({
  status,
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
}: ResultsTabProps) {
  const { t } = useI18n()
  if (status === "completed") {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            {t("results.tournamentEndedNoResults")}
          </p>
        </CardContent>
      </Card>
    )
  }

  // Normalize playerSession to match CurrentRound's expected shape (playerId must be string)
  const normalizedSession =
    playerSession?.playerId && playerSession?.role
      ? { playerId: playerSession.playerId, role: playerSession.role as "player" | "organizer" }
      : undefined

  return (
    <>
      {!effectivePlayerView && isActive && showSimulator && (
        <div className="mb-4">
          <TournamentSimulatorPanel />
        </div>
      )}

      {/* Always route through CurrentRound so the WaitingRoom renders for players */}
      {normalizedSession?.role === "player" ? (
        <CurrentRound
          matches={pairedMatches}
          onRecordResult={onRecordResult}
          playerSession={normalizedSession}
          onPlayerSubmit={onPlayerSubmit}
          onPlayerConfirm={onPlayerConfirm}
          onPlayerCancel={onPlayerCancel}
          canRecordResults={canRecordResults}
          allPlayers={players}
        />
      ) : pairedMatches.length > 0 ? (
        <div className="space-y-4">
          <CurrentRound
            matches={pairedMatches}
            onRecordResult={onRecordResult}
            playerSession={normalizedSession}
            onPlayerSubmit={onPlayerSubmit}
            onPlayerConfirm={onPlayerConfirm}
            onPlayerCancel={onPlayerCancel}
            canRecordResults={canRecordResults}
            allPlayers={players}
          />
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
