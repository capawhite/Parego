"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Player } from "@/lib/types"
import { Zap, Target, TrendingUp, Users, Percent, Minus, LogOut } from "lucide-react"

interface TournamentPodiumProps {
  players: Player[]
  totalMatches: number
  onClose: () => void
}

export function TournamentPodium({ players, totalMatches, onClose }: TournamentPodiumProps) {
  const activePlayers = players.filter((p) => !p.hasLeft)
  const sortedPlayers = [...activePlayers].sort((a, b) => b.score - a.score)
  const topThree = sortedPlayers.slice(0, 3)

  // Calculate fun stats
  const totalGames = activePlayers.reduce((sum, p) => sum + p.gamesPlayed, 0) / 2 // Divide by 2 since each game involves 2 players
  const bestStreak = Math.max(
    ...activePlayers.map((p) => {
      let maxStreak = 0
      let currentStreak = 0
      p.gameResults.forEach((result) => {
        if (result === "W") {
          currentStreak++
          maxStreak = Math.max(maxStreak, currentStreak)
        } else {
          currentStreak = 0
        }
      })
      return maxStreak
    }),
  )

  const bestStreakPlayer = activePlayers.find((p) => {
    let maxStreak = 0
    let currentStreak = 0
    p.gameResults.forEach((result) => {
      if (result === "W") {
        currentStreak++
        maxStreak = Math.max(maxStreak, currentStreak)
      } else {
        currentStreak = 0
      }
    })
    return maxStreak === bestStreak
  })

  const mostGamesPlayed = Math.max(...activePlayers.map((p) => p.gamesPlayed))
  const mostActivePlayer = activePlayers.find((p) => p.gamesPlayed === mostGamesPlayed)

  const calculateWinRatio = (player: Player) => {
    const wins = player.gameResults.filter((r) => r === "W").length
    return player.gamesPlayed > 0 ? (wins / player.gamesPlayed) * 100 : 0
  }

  const bestWinRatio = Math.max(...activePlayers.map((p) => calculateWinRatio(p)))
  const bestWinRatioPlayer = activePlayers.find((p) => calculateWinRatio(p) === bestWinRatio)

  const mostDraws = Math.max(...activePlayers.map((p) => p.gameResults.filter((r) => r === "D").length))
  const mostDrawsPlayer = activePlayers.find((p) => p.gameResults.filter((r) => r === "D").length === mostDraws)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
      <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <CardContent className="pt-8 space-y-8">
          {/* Celebration Header */}
          <div className="text-center space-y-2">
            <div className="text-6xl animate-bounce">🎉</div>
            <h2 className="text-4xl font-bold">Tournament Complete!</h2>
            <p className="text-muted-foreground">Congratulations to all participants</p>
          </div>

          {/* Podium */}
          <div className="flex items-end justify-center gap-4 py-8">
            {/* 2nd Place */}
            {topThree[1] && (
              <div className="flex flex-col items-center animate-in slide-in-from-bottom-4 duration-500 delay-200">
                <div className="text-4xl mb-2">🥈</div>
                <div className="bg-muted rounded-t-lg p-6 pb-8 flex flex-col items-center min-w-[140px] border-4 border-border">
                  <div className="text-5xl font-bold text-muted-foreground mb-2">2</div>
                  <p className="font-bold text-center text-lg text-foreground">{topThree[1].name}</p>
                  <p className="text-2xl font-bold text-foreground mt-2">{topThree[1].score}</p>
                  <p className="text-xs text-muted-foreground">points</p>
                </div>
              </div>
            )}

            {/* 1st Place */}
            {topThree[0] && (
              <div className="flex flex-col items-center animate-in slide-in-from-bottom-4 duration-500">
                <div className="text-6xl mb-2 animate-bounce">🏆</div>
                <div className="bg-primary/20 rounded-t-lg p-6 pb-12 flex flex-col items-center min-w-[160px] border-4 border-primary">
                  <div className="text-6xl font-bold text-primary mb-2">1</div>
                  <p className="font-bold text-center text-xl text-foreground">{topThree[0].name}</p>
                  <p className="text-3xl font-bold text-primary mt-2">{topThree[0].score}</p>
                  <p className="text-xs text-primary">points</p>
                </div>
              </div>
            )}

            {/* 3rd Place */}
            {topThree[2] && (
              <div className="flex flex-col items-center animate-in slide-in-from-bottom-4 duration-500 delay-300">
                <div className="text-4xl mb-2">🥉</div>
                <div className="bg-accent/50 rounded-t-lg p-6 pb-6 flex flex-col items-center min-w-[140px] border-4 border-accent">
                  <div className="text-5xl font-bold text-accent-foreground mb-2">3</div>
                  <p className="font-bold text-center text-lg text-foreground">{topThree[2].name}</p>
                  <p className="text-2xl font-bold text-accent-foreground mt-2">{topThree[2].score}</p>
                  <p className="text-xs text-accent-foreground">points</p>
                </div>
              </div>
            )}
          </div>

          {/* Fun Statistics */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-center">Tournament Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card className="bg-chart-1/10 border-chart-1/30">
                <CardContent className="pt-6 text-center">
                  <Target className="w-8 h-8 mx-auto mb-2 text-chart-1" />
                  <p className="text-3xl font-bold text-foreground">{Math.floor(totalGames)}</p>
                  <p className="text-sm text-muted-foreground">Total Games</p>
                </CardContent>
              </Card>

              <Card className="bg-chart-2/10 border-chart-2/30">
                <CardContent className="pt-6 text-center">
                  <Zap className="w-8 h-8 mx-auto mb-2 text-chart-2" />
                  <p className="text-3xl font-bold text-foreground">{bestStreak}</p>
                  <p className="text-sm text-muted-foreground">Best Streak</p>
                  {bestStreakPlayer && (
                    <p className="text-base font-semibold text-chart-2 mt-1">{bestStreakPlayer.name}</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-chart-3/10 border-chart-3/30">
                <CardContent className="pt-6 text-center">
                  <Users className="w-8 h-8 mx-auto mb-2 text-chart-3" />
                  <p className="text-3xl font-bold text-foreground">{players.length}</p>
                  <p className="text-sm text-muted-foreground">Participants</p>
                </CardContent>
              </Card>

              <Card className="bg-chart-4/10 border-chart-4/30">
                <CardContent className="pt-6 text-center">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 text-chart-4" />
                  <p className="text-3xl font-bold text-foreground">{mostGamesPlayed}</p>
                  <p className="text-sm text-muted-foreground">Most Games</p>
                  {mostActivePlayer && (
                    <p className="text-base font-semibold text-chart-4 mt-1">{mostActivePlayer.name}</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-chart-5/10 border-chart-5/30">
                <CardContent className="pt-6 text-center">
                  <Percent className="w-8 h-8 mx-auto mb-2 text-chart-5" />
                  <p className="text-3xl font-bold text-foreground">{bestWinRatio.toFixed(0)}%</p>
                  <p className="text-sm text-muted-foreground">Best Win Ratio</p>
                  {bestWinRatioPlayer && (
                    <p className="text-base font-semibold text-chart-5 mt-1">{bestWinRatioPlayer.name}</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-muted/50 border-border">
                <CardContent className="pt-6 text-center">
                  <Minus className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-3xl font-bold text-foreground">{mostDraws}</p>
                  <p className="text-sm text-muted-foreground">Most Draws</p>
                  {mostDrawsPlayer && (
                    <p className="text-base font-semibold text-muted-foreground mt-1">{mostDrawsPlayer.name}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Final Standings */}
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-center">Final Standings</h3>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {sortedPlayers.map((player, index) => {
                const winRatio = calculateWinRatio(player)
                const wins = player.gameResults.filter((r) => r === "W").length
                const playerRank = index

                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      playerRank >= 0 && playerRank < 3
                        ? "bg-primary/10 border border-primary/30"
                        : player.hasLeft
                          ? "bg-destructive/5 border border-destructive/20"
                          : "bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold w-8">{playerRank >= 0 ? playerRank + 1 : "–"}</span>
                      <span className="font-semibold">{player.name}</span>
                      {player.hasLeft && (
                        <div className="flex items-center gap-1 text-destructive text-sm">
                          <LogOut className="w-4 h-4" />
                          <span>left</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">{player.gamesPlayed} games</span>
                      <span className="text-sm font-medium text-chart-4">
                        {wins}W ({winRatio.toFixed(0)}%)
                      </span>
                      <span className="text-xl font-bold">{player.score}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Close Button */}
          <Button onClick={onClose} className="w-full" size="lg">
            Close
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
