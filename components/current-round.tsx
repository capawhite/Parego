"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import type { Match } from "@/lib/types"
import { MatchResultSubmitter } from "@/components/match-result-submitter"

interface CurrentRoundProps {
  matches: Match[]
  onRecordResult: (matchId: string, winnerId?: string, isDraw?: boolean) => void
  onPlayerSubmit?: (matchId: string, result: "player1-win" | "draw" | "player2-win") => void
  onPlayerConfirm?: (matchId: string) => void
  onPlayerCancel?: (matchId: string) => void
  playerSession?: { playerId: string; role: "player" | "organizer" }
  canRecordResults?: boolean // Permission to show record buttons (organizer only)
}

export function CurrentRound({
  matches,
  onRecordResult,
  onPlayerSubmit,
  onPlayerConfirm,
  onPlayerCancel,
  playerSession,
  canRecordResults = false,
}: CurrentRoundProps) {
  const visibleMatches =
    playerSession?.role === "player"
      ? matches.filter((m) => m.player1.id === playerSession.playerId || m.player2.id === playerSession.playerId)
      : matches

  const pendingMatches = visibleMatches.filter((m) => !m.result?.completed)
  const completedMatches = visibleMatches.filter((m) => m.result?.completed)

  const recordMatchResult = (matchId: string, winnerId: string | undefined, isDraw: boolean) => {
    onRecordResult(matchId, winnerId, isDraw)
  }

  const sortedPendingMatches = [...pendingMatches].sort((a, b) => {
    if (a.tableNumber && b.tableNumber) {
      return a.tableNumber - b.tableNumber
    }
    return 0
  })

  if (playerSession?.role === "player" && sortedPendingMatches.length === 0 && completedMatches.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">You don't have any matches yet.</p>
        <p className="text-sm text-muted-foreground mt-2">Wait for the organizer to pair the next round.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sortedPendingMatches.length > 0 && (
        <div>
          <h3 className="font-semibold text-xs mb-1 text-muted-foreground uppercase tracking-wide">
            {playerSession?.role === "player" ? "Your Match" : "Active Matches"}
          </h3>
          <div className="space-y-1">
            {sortedPendingMatches.map((match) => {
              const isPlayer = playerSession?.role === "player"
              const isPlayer1 = match.player1.id === playerSession?.playerId
              const isPlayer2 = match.player2.id === playerSession?.playerId
              const isPlayerInMatch = isPlayer1 || isPlayer2

              const mySubmission = isPlayer1 ? match.player1Submission : match.player2Submission
              const opponentSubmission = isPlayer1 ? match.player2Submission : match.player1Submission

              // Only show submission form if player is IN this match
              if (isPlayer && isPlayerInMatch) {
                return (
                  <MatchResultSubmitter
                    key={match.id}
                    matchId={match.id}
                    player1Name={match.player1.name}
                    player2Name={match.player2.name}
                    isPlayer1={isPlayer1}
                    mySubmission={mySubmission}
                    opponentSubmission={opponentSubmission}
                    onSubmit={(result) => onPlayerSubmit(match.id, result)}
                    onConfirm={() => onPlayerConfirm(match.id)}
                    onCancel={() => onPlayerCancel(match.id)}
                  />
                )
              }

              return (
                <Card key={match.id} className="border-l-4 border-l-primary/30 bg-muted/30">
                  <CardContent className="p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        {match.tableNumber && (
                          <div className="px-2 py-0.5 bg-primary text-primary-foreground rounded text-xs font-bold flex-shrink-0">
                            {match.tableNumber}
                          </div>
                        )}
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          <div
                            className="w-3 h-3 bg-white border-2 border-gray-400 rounded-sm flex-shrink-0"
                            title="White"
                          />
                          <span className="font-medium text-sm truncate">{match.player1.name}</span>
                          <span className="text-muted-foreground text-xs flex-shrink-0">vs</span>
                          <div
                            className="w-3 h-3 bg-gray-900 border-2 border-gray-600 rounded-sm flex-shrink-0"
                            title="Black"
                          />
                          <span className="font-medium text-sm truncate">{match.player2.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {(match.player1Submission?.confirmed || match.player2Submission?.confirmed) && (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 text-orange-500" />
                            <span className="text-[10px] text-muted-foreground">
                              {match.player1Submission?.confirmed && match.player2Submission?.confirmed
                                ? match.player1Submission.result === match.player2Submission.result
                                  ? "✓"
                                  : "⚠"
                                : "1"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {canRecordResults && (
                      <div className="flex mt-2 justify-start gap-6">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-3 hover:bg-primary hover:text-primary-foreground bg-transparent"
                          onClick={() => recordMatchResult(match.id, match.player1.id, false)}
                        >
                          White Wins
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-3 hover:bg-primary hover:text-primary-foreground bg-transparent"
                          onClick={() => recordMatchResult(match.id, undefined, true)}
                        >
                          Draw
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-3 hover:bg-primary hover:text-primary-foreground bg-transparent"
                          onClick={() => recordMatchResult(match.id, match.player2.id, false)}
                        >
                          Black Wins
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {completedMatches.length > 0 && (
        <div>
          <h3 className="font-semibold text-xs mb-1 text-muted-foreground uppercase tracking-wide">
            Completed ({completedMatches.length})
          </h3>
          <div className="space-y-1">
            {completedMatches.map((match) => (
              <Card key={match.id} className="opacity-70 hover:opacity-100 transition-opacity bg-muted/20">
                <CardContent className="p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      {match.tableNumber && (
                        <span className="text-xs font-bold text-primary flex-shrink-0">{match.tableNumber}</span>
                      )}
                      <div
                        className="w-3 h-3 bg-white border-2 border-gray-400 rounded-sm flex-shrink-0"
                        title="White"
                      />
                      <span
                        className={`text-sm truncate ${match.result?.winnerId === match.player1.id ? "font-bold" : ""}`}
                      >
                        {match.player1.name}
                      </span>
                      <span className="text-muted-foreground text-xs flex-shrink-0">vs</span>
                      <div
                        className="w-3 h-3 bg-gray-900 border-2 border-gray-600 rounded-sm flex-shrink-0"
                        title="Black"
                      />
                      <span
                        className={`text-sm truncate ${match.result?.winnerId === match.player2.id ? "font-bold" : ""}`}
                      >
                        {match.player2.name}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium flex-shrink-0">
                      {match.result?.isDraw ? "½-½" : match.result?.winnerId === match.player1.id ? "1-0" : "0-1"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
