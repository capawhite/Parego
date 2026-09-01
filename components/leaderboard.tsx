"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Download, Printer } from "lucide-react"
import type { Player, TournamentSettings } from "@/lib/types"
import { DEFAULT_SETTINGS } from "@/lib/types"
import { calculatePerformance, sortPlayersByStandings, standingsToCsv } from "@/lib/standings"
import { calculatePointsFromSettings } from "@/lib/points"
import { useI18n } from "@/components/i18n-provider"

interface LeaderboardProps {
  players: Player[]
  isPlayerView?: boolean
  onOverrideResult?: (playerId: string, gameIndex: number, newResult: "W" | "D" | "L") => void
  settings?: TournamentSettings
}

export function Leaderboard({ players, isPlayerView = false, onOverrideResult, settings = DEFAULT_SETTINGS }: LeaderboardProps) {
  const { t } = useI18n()
  const [viewMode, setViewMode] = useState<"points" | "performance">("points")
  const sorted = sortPlayersByStandings(players, viewMode)

  const handleExportCsv = () => {
    const blob = new Blob([standingsToCsv(sorted)], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "standings.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const renderCompactMatchHistory = (player: Player) => {
    if (!player.gameResults || player.gameResults.length === 0) return null

    return (
      <div className="flex flex-wrap gap-1.5 mt-2">
        {player.gameResults.map((result, i) => {
          const pieceColor = player.pieceColors?.[i] || "white"
          const opponentId = player.opponentIds?.[i]
          const opponent = players.find((p) => p.id === opponentId)
          const opponentName = opponent?.name || "Unknown"
          const tableNumber = player.tableNumbers?.[i]

          let streakBeforeThisGame = 0
          for (let j = i - 1; j >= 0; j--) {
            if (player.gameResults[j] === "W") {
              streakBeforeThisGame++
            } else {
              break
            }
          }

          const hasDoublePointStreak =
            settings.pairingAlgorithm !== "swiss" &&
            settings.pairingAlgorithm !== "fide-swiss" &&
            settings.streakEnabled &&
            streakBeforeThisGame >= 2
          const playerPoints = player.pointsEarned?.[i] ?? calculatePointsFromSettings(
            result === "W",
            result === "D",
            streakBeforeThisGame,
            settings,
          )

          const resultBadge = (
            <span
              className={`font-semibold px-2 py-1 rounded cursor-help transition-transform hover:scale-105 ${
                pieceColor === "white"
                  ? "bg-white text-gray-900 border border-gray-300"
                  : "bg-gray-900 text-white border border-gray-700"
              }`}
            >
              {result}: {playerPoints}
            </span>
          )

          if (!isPlayerView && onOverrideResult) {
            return (
              <ContextMenu key={i}>
                <ContextMenuTrigger asChild>
                  <div
                    className="text-xs flex items-center gap-1"
                    title={t("arena.vsOpponentRightClickOverride", { opponent: opponentName, streak: hasDoublePointStreak ? t("arena.doublePointStreak") : "" })}
                  >
                    {tableNumber && <span className="font-medium text-muted-foreground">T{tableNumber}</span>}
                    {resultBadge}
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-48">
                  <ContextMenuItem onClick={() => onOverrideResult(player.id, i, "W")} disabled={result === "W"}>
                    {t("arena.changeToWin")}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => onOverrideResult(player.id, i, "D")} disabled={result === "D"}>
                    {t("arena.changeToDraw")}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => onOverrideResult(player.id, i, "L")} disabled={result === "L"}>
                    {t("arena.changeToLoss")}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            )
          }

          return (
            <div
              key={i}
              className="text-xs flex items-center gap-1"
              title={`vs ${opponentName}${hasDoublePointStreak ? ` ${t("arena.doublePointStreak")}` : ""}`}
            >
              {tableNumber && <span className="font-medium text-muted-foreground">T{tableNumber}</span>}
              {resultBadge}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg md:text-xl">{t("arena.standingsTitle")}</CardTitle>
          <div className="flex items-center gap-1.5 print:hidden">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={handleExportCsv} title={t("common.exportCsv")}>
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => window.print()} title={t("common.print")}>
              <Printer className="h-3.5 w-3.5" />
            </Button>
            <div className="flex gap-1 border rounded-lg p-1">
              <Button
                variant={viewMode === "points" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("points")}
                className="h-8 text-xs"
              >
                {t("arena.viewPoints")}
              </Button>
              <Button
                variant={viewMode === "performance" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("performance")}
                className="h-8 text-xs"
              >
                {t("arena.viewPerformance")}
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 md:p-6">
        {sorted.length === 0 ? (
          <p className="text-muted-foreground text-center py-4 text-sm md:text-base">{t("arena.noPlayersYet")}</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((player, idx) => {
              const performance = calculatePerformance(player)
              const pointsPerGame = player.gamesPlayed > 0 ? (player.score / player.gamesPlayed).toFixed(1) : "0.0"
              const isTiedOnScore = sorted.some((p) => p.id !== player.id && p.score === player.score)

              return (
                <div
                  key={player.id}
                  className="flex flex-col md:flex-row md:justify-between md:items-center p-3 md:p-4 bg-muted rounded hover:bg-muted/80 border border-transparent hover:border-border transition-colors gap-2 md:gap-0"
                >
                  <div className="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
                    <span className="font-bold text-base md:text-lg w-6 md:w-8 text-center flex-shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm truncate md:text-lg font-bold">{player.name}</span>
                        {player.streak > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-accent text-accent-foreground rounded font-semibold flex-shrink-0">
                            🔥 {player.streak}
                          </span>
                        )}
                      </div>

                      {renderCompactMatchHistory(player)}

                      {player.gamesPlayed > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {player.gamesPlayed} game{player.gamesPlayed !== 1 ? "s" : ""} • {pointsPerGame} pts/game
                        </p>
                      )}
                      {player.gamesPlayed > 0 && isTiedOnScore && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {t("arena.tiebreakSummary", {
                            buchholz: (player.buchholz ?? 0).toFixed(1),
                            sb: (player.sonnebornBerger ?? 0).toFixed(1),
                          })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between md:block text-right md:ml-4 flex-shrink-0">
                    <div className="md:hidden text-xs text-muted-foreground">
                      {viewMode === "points" ? "Total Score" : "Performance"}
                    </div>
                    <div>
                      <p className="font-bold text-lg md:text-xl">
                        {viewMode === "points" ? player.score : performance.toFixed(2)}
                      </p>
                      {player.gamesPlayed > 0 && (
                        <p className="text-xs text-muted-foreground font-medium">
                          {viewMode === "points" ? `Perf: ${performance.toFixed(2)}` : `Points: ${player.score}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
