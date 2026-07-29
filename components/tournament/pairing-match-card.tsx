"use client"

import { AlertCircle, Clock } from "lucide-react"
import type { Match } from "@/lib/types"
import { useI18n } from "@/components/i18n-provider"

interface PairingMatchCardProps {
  match: Match
  /** Tab shows conflict / one-submitted hints; fullscreen grid omits them */
  showSubmissionStatus?: boolean
}

export function PairingMatchCard({ match, showSubmissionStatus = true }: PairingMatchCardProps) {
  const { t } = useI18n()
  const p1Sub = match.player1Submission
  const p2Sub = match.player2Submission
  const bothSubmitted = p1Sub?.confirmed && p2Sub?.confirmed
  const hasConflict = bothSubmitted && p1Sub.result !== p2Sub.result
  const oneSubmitted = (p1Sub?.confirmed || p2Sub?.confirmed) && !bothSubmitted

  return (
    <div
      className={`border-2 rounded-lg hover:bg-accent/50 transition-colors overflow-hidden ${
        showSubmissionStatus && hasConflict
          ? "border-destructive bg-destructive/5"
          : showSubmissionStatus && oneSubmitted
            ? "border-primary/50"
            : "border-border"
      }`}
    >
      {match.tableNumber != null && (
        <div className="bg-primary px-3 py-1.5 flex items-center gap-2">
          <span className="text-primary-foreground font-bold text-sm">
            {t("arena.tableNumber", { number: match.tableNumber })}
          </span>
        </div>
      )}

      <div className="p-2 space-y-1">
        <div className="flex items-center gap-2 bg-muted/60 rounded px-2 py-1">
          <div className="w-4 h-4 bg-card border-2 border-border rounded-sm flex-shrink-0" />
          <span className="font-semibold text-sm break-words">{match.player1.name}</span>
        </div>
        <div className="text-center text-xs text-muted-foreground">vs</div>
        <div className="flex items-center gap-2 bg-muted rounded px-2 py-1">
          <div className="w-4 h-4 bg-foreground border-2 border-foreground/40 rounded-sm flex-shrink-0" />
          <span className="font-semibold text-sm break-words">{match.player2.name}</span>
        </div>

        {showSubmissionStatus && hasConflict && (
          <div className="flex items-center gap-1 px-1 py-0.5 text-destructive text-xs font-medium">
            <AlertCircle className="h-3.5 w-3.5" />
            {t("arena.resultConflictCheckResults")}
          </div>
        )}
        {showSubmissionStatus && oneSubmitted && (
          <div className="flex items-center gap-1 px-1 py-0.5 text-primary text-xs">
            <Clock className="h-3 w-3" />
            {t("arena.oneResultSubmitted")}
          </div>
        )}
      </div>
    </div>
  )
}
