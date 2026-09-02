"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Match } from "@/lib/types"
import { isPairingByeMatch } from "@/lib/pairing/swiss"
import { formatMatchResultShort, groupCompletedMatchesByRound } from "@/lib/swiss-crosstable"
import { useI18n } from "@/components/i18n-provider"

type SwissRoundHistoryProps = {
  completedMatches: Match[]
}

export function SwissRoundHistory({ completedMatches }: SwissRoundHistoryProps) {
  const { t } = useI18n()
  const groups = groupCompletedMatchesByRound(completedMatches)

  if (groups.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("swiss.roundHistoryTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {groups.map(({ round, matches }) => (
          <div key={round}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {t("swiss.roundLabel", { round })}
            </h3>
            <div className="space-y-1.5">
              {matches.map((match) => (
                <div
                  key={match.id}
                  className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-2.5 py-2 text-sm"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {match.tableNumber != null && match.tableNumber > 0 && (
                      <span className="text-xs font-bold text-primary shrink-0">T{match.tableNumber}</span>
                    )}
                    {isPairingByeMatch(match) ? (
                      <span className="truncate">
                        <span className="font-medium">{match.player1.name}</span>
                        <span className="text-muted-foreground text-xs ml-1.5">{t("swiss.pairingBye")}</span>
                      </span>
                    ) : (
                      <span className="truncate">
                        <span className={match.result?.winnerId === match.player1.id ? "font-semibold" : ""}>
                          {match.player1.name}
                        </span>
                        <span className="text-muted-foreground text-xs mx-1">{t("currentRound.vs")}</span>
                        <span className={match.result?.winnerId === match.player2.id ? "font-semibold" : ""}>
                          {match.player2.name}
                        </span>
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground shrink-0">
                    {formatMatchResultShort(match)}
                    {match.result?.isForfeit ? (
                      <span className="ml-1 text-[10px] uppercase">{t("swiss.forfeitShort")}</span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
