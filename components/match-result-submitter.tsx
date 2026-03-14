"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useI18n } from "@/components/i18n-provider"

const DEBUG_SUBMIT = true // Set to false to reduce console noise

interface MatchResultSubmitterProps {
  matchId: string
  player1Name: string
  player2Name: string
  isPlayer1: boolean
  mySubmission?: {
    result: "player1-win" | "draw" | "player2-win"
    confirmed: boolean
    timestamp: number
  }
  opponentSubmission?: {
    result: "player1-win" | "draw" | "player2-win"
    confirmed: boolean
    timestamp: number
  }
  onSubmit: (result: "player1-win" | "draw" | "player2-win") => void
  onConfirm: (result: "player1-win" | "draw" | "player2-win") => void
  onCancel: () => void
}

export function MatchResultSubmitter({
  matchId,
  player1Name,
  player2Name,
  isPlayer1,
  mySubmission,
  opponentSubmission,
  onSubmit,
  onConfirm,
  onCancel: _onCancel,
}: MatchResultSubmitterProps) {
  const { t } = useI18n()
  const [selectedResult, setSelectedResult] = useState<"player1-win" | "draw" | "player2-win" | null>(null)

  const handleSelectResult = (result: "player1-win" | "draw" | "player2-win") => {
    if (DEBUG_SUBMIT) console.log("[result-submit] Selected result:", result, "matchId:", matchId)
    setSelectedResult(result)
    onSubmit(result)
  }

  const handleSubmit = () => {
    if (selectedResult == null) return
    if (DEBUG_SUBMIT) console.log("[result-submit] Submitting to server:", selectedResult, "matchId:", matchId)
    onConfirm(selectedResult)
  }

  const getResultText = (result: "player1-win" | "draw" | "player2-win") => {
    if (result === "draw") return t("currentRound.draw")
    if (result === "player1-win") return t("arena.playerWins", { name: player1Name })
    return t("arena.playerWins", { name: player2Name })
  }

  // Check for conflict
  const hasConflict =
    mySubmission?.confirmed && opponentSubmission?.confirmed && mySubmission.result !== opponentSubmission.result

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="text-center">
          <h4 className="font-semibold text-lg mb-2">{t("arena.submitMatchResult")}</h4>
          <p className="text-sm text-muted-foreground">
            {t("arena.whiteVsBlack", { player1: player1Name, player2: player2Name })}
          </p>
        </div>

        {hasConflict && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>{t("arena.resultConflict")}</strong>
              <br />
              {t("arena.youSubmitted")} {getResultText(mySubmission.result)}
              <br />
              {t("arena.opponentSubmitted")} {getResultText(opponentSubmission!.result)}
              <br />
              <span className="text-xs mt-1 block">
                {t("arena.resubmitOrOrganizerResolve")}
              </span>
            </AlertDescription>
          </Alert>
        )}

        {mySubmission?.confirmed && !hasConflict && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              {t("arena.youSubmitted")} <strong>{getResultText(mySubmission.result)}</strong>
              {!opponentSubmission?.confirmed && (
                <>
                  <br />
                  {t("arena.waitingForOpponentSubmit")}
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {opponentSubmission?.confirmed && !mySubmission?.confirmed && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t("arena.opponentSubmittedConfirmYours")}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          <Button
            variant={selectedResult === "player1-win" ? "default" : "outline"}
            className="w-full"
            onClick={() => handleSelectResult("player1-win")}
            disabled={mySubmission?.confirmed && !hasConflict}
          >
            {t("arena.playerWinsWhite", { name: player1Name })}
          </Button>
          <Button
            variant={selectedResult === "draw" ? "default" : "outline"}
            className="w-full"
            onClick={() => handleSelectResult("draw")}
            disabled={mySubmission?.confirmed && !hasConflict}
          >
            {t("currentRound.draw")}
          </Button>
          <Button
            variant={selectedResult === "player2-win" ? "default" : "outline"}
            className="w-full"
            onClick={() => handleSelectResult("player2-win")}
            disabled={mySubmission?.confirmed && !hasConflict}
          >
            {t("arena.playerWinsBlack", { name: player2Name })}
          </Button>
          <Button
            className="w-full mt-2"
            onClick={handleSubmit}
            disabled={selectedResult == null || (mySubmission?.confirmed && !hasConflict)}
          >
            {t("arena.submitResultButton")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
