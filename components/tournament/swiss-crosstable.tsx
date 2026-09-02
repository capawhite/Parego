"use client"

import type { Match, Player } from "@/lib/types"
import { buildSwissCrosstable } from "@/lib/swiss-crosstable"
import { useI18n } from "@/components/i18n-provider"
import { cn } from "@/lib/utils"

type SwissCrosstableProps = {
  players: Player[]
  matches: Match[]
  plannedRounds: number
}

export function SwissCrosstable({ players, matches, plannedRounds }: SwissCrosstableProps) {
  const { t } = useI18n()
  const rows = buildSwissCrosstable(players, matches, plannedRounds)

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">{t("swiss.crosstableEmpty")}</p>
  }

  const roundCount = rows[0]?.cells.length ?? 0

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full min-w-[480px] text-sm border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left font-medium text-muted-foreground py-2 pr-2 sticky left-0 bg-card z-10">
              #
            </th>
            <th className="text-left font-medium text-muted-foreground py-2 pr-3 sticky left-6 bg-card z-10 min-w-[120px]">
              {t("swiss.crosstablePlayer")}
            </th>
            {Array.from({ length: roundCount }, (_, i) => (
              <th key={i} className="text-center font-medium text-muted-foreground py-2 px-1.5 w-10">
                R{i + 1}
              </th>
            ))}
            <th className="text-right font-medium text-muted-foreground py-2 pl-2">{t("swiss.crosstablePts")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.player.id} className="border-b border-border/60 hover:bg-muted/40">
              <td className="py-2 pr-2 text-muted-foreground tabular-nums sticky left-0 bg-card">{idx + 1}</td>
              <td className="py-2 pr-3 font-medium truncate max-w-[160px] sticky left-6 bg-card">
                {row.player.name}
              </td>
              {row.cells.map((cell) => (
                <td
                  key={cell.round}
                  className="text-center py-2 px-1.5 tabular-nums"
                  title={
                    cell.isBye
                      ? t("swiss.pairingBye")
                      : cell.opponentName
                        ? `${cell.color === "white" ? t("currentRound.white") : t("currentRound.black")} vs ${cell.opponentName}`
                        : undefined
                  }
                >
                  <span
                    className={cn(
                      "inline-flex min-w-[1.5rem] justify-center rounded px-1",
                      cell.scoreText === "1" || cell.scoreText === "1F" || cell.scoreText === "+"
                        ? "bg-primary/10 text-primary font-semibold"
                        : cell.scoreText === "½"
                          ? "bg-muted font-medium"
                          : cell.scoreText === "—"
                            ? "text-muted-foreground/50"
                            : "text-muted-foreground",
                    )}
                  >
                    {cell.scoreText}
                  </span>
                </td>
              ))}
              <td className="text-right py-2 pl-2 font-bold tabular-nums">{row.player.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-muted-foreground mt-2">{t("swiss.crosstableLegend")}</p>
    </div>
  )
}
