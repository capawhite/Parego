"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Match } from "@/lib/types"
import { Loader2, Maximize2 } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { PairingMatchCard } from "@/components/tournament/pairing-match-card"

export interface ArenaPairingsTabProps {
  /** Active (non-completed) pairings, typically sorted by table number */
  matches: Match[]
  onOpenFullScreen: () => void
  /** Club Swiss: organizer can pair the next round when ready */
  swissControls?: {
    currentRound: number
    plannedRounds: number
    canPairNext: boolean
    pairingBusy: boolean
    onPairNextRound: () => void | Promise<void>
  } | null
}

export function ArenaPairingsTab({ matches, onOpenFullScreen, swissControls }: ArenaPairingsTabProps) {
  const { t } = useI18n()

  return (
    <div className="space-y-3">
      {swissControls && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t("swiss.roundProgress", {
                current: swissControls.currentRound,
                planned: swissControls.plannedRounds,
              })}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 flex flex-wrap items-center gap-3">
            <Button
              onClick={() => void swissControls.onPairNextRound()}
              disabled={!swissControls.canPairNext || swissControls.pairingBusy}
            >
              {swissControls.pairingBusy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("swiss.pairing")}
                </>
              ) : (
                t("swiss.pairNextRound")
              )}
            </Button>
            {!swissControls.canPairNext && (
              <p className="text-sm text-muted-foreground">{t("swiss.pairNextRoundBlocked")}</p>
            )}
          </CardContent>
        </Card>
      )}

      {matches.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">{t("arena.noActivePairings")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("arena.currentPairings")}</CardTitle>
              <Button variant="outline" size="sm" onClick={onOpenFullScreen}>
                <Maximize2 className="h-4 w-4 mr-2" />
                {t("arena.fullScreen")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-3">
              {matches.map((match) => (
                <PairingMatchCard key={match.id} match={match} showSubmissionStatus />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
