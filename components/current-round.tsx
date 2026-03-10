"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, Clock } from "lucide-react"
import type { Match, Player } from "@/lib/types"
import { MatchResultSubmitter } from "@/components/match-result-submitter"

interface CurrentRoundProps {
  matches: Match[]
  onRecordResult: (matchId: string, winnerId?: string, isDraw?: boolean) => void
  onPlayerSubmit?: (matchId: string, result: "player1-win" | "draw" | "player2-win") => void
  onPlayerConfirm?: (matchId: string) => void
  onPlayerCancel?: (matchId: string) => void
  playerSession?: { playerId: string; role: "player" | "organizer" }
  canRecordResults?: boolean
  allPlayers?: Player[]
}

function WaitingRoom({
  playerId,
  allPlayers,
}: {
  playerId: string
  allPlayers: Player[]
}) {
  const sorted = [...allPlayers]
    .filter((p) => !p.hasLeft)
    .sort((a, b) => b.score - a.score || b.gamesPlayed - a.gamesPlayed)

  const rank = sorted.findIndex((p) => p.id === playerId) + 1
  const me = sorted.find((p) => p.id === playerId)
  const topTen = sorted.slice(0, 10)

  return (
    <div className="space-y-3">
      {/* Status card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm">Waiting to be paired</p>
              <p className="text-xs text-muted-foreground">You'll be notified when your next match is ready</p>
            </div>
            {me && (
              <div className="ml-auto text-right flex-shrink-0">
                <p className="text-lg font-bold leading-none">{me.score}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">pts</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mini standings */}
      {topTen.length > 0 && (
        <div>
          <h3 className="font-semibold text-xs mb-2 text-muted-foreground uppercase tracking-wide">
            Standings
          </h3>
          <div className="space-y-0.5">
            {topTen.map((p, i) => {
              const isMe = p.id === playerId
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors ${
                    isMe ? "bg-primary/10 font-semibold" : "hover:bg-muted/40"
                  }`}
                >
                  <span
                    className={`w-5 text-center text-xs font-bold flex-shrink-0 ${
                      i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="font-bold tabular-nums">{p.score}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
                    {p.gamesPlayed}g
                  </span>
                </div>
              )
            })}
          </div>
          {rank > 10 && me && (
            <>
              <div className="text-center text-muted-foreground text-xs py-1">•••</div>
              <div className="flex items-center gap-2 rounded px-2 py-1.5 text-sm bg-primary/10 font-semibold">
                <span className="w-5 text-center text-xs font-bold text-muted-foreground flex-shrink-0">{rank}</span>
                <span className="flex-1 truncate">{me.name}</span>
                <span className="font-bold tabular-nums">{me.score}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{me.gamesPlayed}g</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function CurrentRound({
  matches,
  onRecordResult,
  onPlayerSubmit,
  onPlayerConfirm,
  onPlayerCancel,
  playerSession,
  canRecordResults = false,
  allPlayers = [],
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

  return (
    <div className="space-y-2">
      {/* Waiting Room — shown when player has no pending match */}
      {playerSession?.role === "player" && sortedPendingMatches.length === 0 && (
        <WaitingRoom playerId={playerSession.playerId} allPlayers={allPlayers} />
      )}

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

              const p1Sub = match.player1Submission
              const p2Sub = match.player2Submission
              const bothSubmitted = p1Sub?.confirmed && p2Sub?.confirmed
              const hasConflict = bothSubmitted && p1Sub.result !== p2Sub.result
              const bothAgree = bothSubmitted && p1Sub.result === p2Sub.result
              const oneSubmitted = (p1Sub?.confirmed || p2Sub?.confirmed) && !bothSubmitted

              const resultLabel = (r: string) =>
                r === "draw" ? "Draw" : r === "player1-win" ? `${match.player1.name} wins` : `${match.player2.name} wins`

              return (
                <Card
                  key={match.id}
                  className={`border-l-4 bg-muted/30 ${
                    hasConflict ? "border-l-red-500 bg-red-50/50 dark:bg-red-950/20" :
                    bothAgree ? "border-l-green-500 bg-green-50/50 dark:bg-green-950/20" :
                    oneSubmitted ? "border-l-amber-400" :
                    "border-l-primary/30"
                  }`}
                >
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
                    </div>

                    {/* Submission status banner */}
                    {hasConflict && (
                      <div className="mt-1.5 px-2 py-1.5 bg-red-100 dark:bg-red-900/30 rounded text-xs space-y-0.5">
                        <div className="flex items-center gap-1 font-semibold text-red-700 dark:text-red-400">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Result conflict — please resolve
                        </div>
                        <div className="text-red-600 dark:text-red-400">
                          {match.player1.name}: <strong>{resultLabel(p1Sub.result)}</strong>
                        </div>
                        <div className="text-red-600 dark:text-red-400">
                          {match.player2.name}: <strong>{resultLabel(p2Sub.result)}</strong>
                        </div>
                      </div>
                    )}
                    {bothAgree && (
                      <div className="mt-1.5 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded text-xs flex items-center gap-1 text-green-700 dark:text-green-400">
                        <Clock className="h-3 w-3" />
                        Both agree: <strong>{resultLabel(p1Sub.result)}</strong> — auto-confirming…
                      </div>
                    )}
                    {oneSubmitted && (
                      <div className="mt-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {p1Sub?.confirmed
                          ? `${match.player1.name} submitted: ${resultLabel(p1Sub.result)} — waiting for opponent`
                          : `${match.player2.name} submitted: ${resultLabel(p2Sub!.result)} — waiting for opponent`}
                      </div>
                    )}

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
