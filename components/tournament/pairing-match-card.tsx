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
          ? "border-red-500 bg-red-50/50 dark:bg-red-950/20"
          : showSubmissionStatus && oneSubmitted
            ? "border-amber-400"
            : ""
      }`}
    >
      {match.tableNumber != null && (
        <div className="bg-amber-700 px-3 py-1 flex items-center gap-2">
          <span className="text-white font-bold text-sm">
            {t("arena.tableNumber", { number: match.tableNumber })}
          </span>
        </div>
      )}

      <div className="p-2 space-y-1">
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded px-2 py-1">
          <div className="w-4 h-4 bg-white border-2 border-gray-300 rounded-sm flex-shrink-0" />
          <span className="font-semibold text-sm break-words">{match.player1.name}</span>
        </div>
        <div className="text-center text-xs text-muted-foreground">vs</div>
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded px-2 py-1">
          <div className="w-4 h-4 bg-gray-900 border-2 border-gray-600 rounded-sm flex-shrink-0" />
          <span className="font-semibold text-sm break-words">{match.player2.name}</span>
        </div>

        {showSubmissionStatus && hasConflict && (
          <div className="flex items-center gap-1 px-1 py-0.5 text-red-600 dark:text-red-400 text-xs font-medium">
            <AlertCircle className="h-3.5 w-3.5" />
            {t("arena.resultConflictCheckResults")}
          </div>
        )}
        {showSubmissionStatus && oneSubmitted && (
          <div className="flex items-center gap-1 px-1 py-0.5 text-amber-600 dark:text-amber-400 text-xs">
            <Clock className="h-3 w-3" />
            {t("arena.oneResultSubmitted")}
          </div>
        )}
      </div>
    </div>
  )
}
