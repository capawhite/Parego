"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PairingMatchCard } from "@/components/tournament/pairing-match-card"
import { useI18n } from "@/components/i18n-provider"
import type { Match } from "@/lib/types"
import { Printer, X } from "lucide-react"

type ArenaFullscreenPairingsProps = {
  displayName: string
  matches: Match[]
  onClose: () => void
}

export function ArenaFullscreenPairings({
  displayName,
  matches,
  onClose,
}: ArenaFullscreenPairingsProps) {
  const { t } = useI18n()

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-secondary print:static print:inset-auto print:overflow-visible print:bg-white">
      <div className="container mx-auto py-3 px-4">
        <div className="mb-3 space-y-1">
          <p className="text-sm font-medium text-muted-foreground truncate" title={displayName}>
            {displayName}
          </p>
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-2xl font-bold">{t("arena.currentPairings")}</h1>
            <div className="flex items-center gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />
                {t("common.print")}
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                <X className="h-4 w-4 mr-2" />
                {t("common.close")}
              </Button>
            </div>
          </div>
        </div>

        {matches.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 print:grid-cols-3 gap-2">
            {matches.map((match) => (
              <PairingMatchCard key={match.id} match={match} showSubmissionStatus={false} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">{t("arena.noActivePairings")}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
