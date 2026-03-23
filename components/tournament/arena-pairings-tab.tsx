"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Match } from "@/lib/types"
import { Maximize2 } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { PairingMatchCard } from "@/components/tournament/pairing-match-card"

export interface ArenaPairingsTabProps {
  /** Active (non-completed) pairings, typically sorted by table number */
  matches: Match[]
  onOpenFullScreen: () => void
}

export function ArenaPairingsTab({ matches, onOpenFullScreen }: ArenaPairingsTabProps) {
  const { t } = useI18n()

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">{t("arena.noActivePairings")}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
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
    </div>
  )
}
