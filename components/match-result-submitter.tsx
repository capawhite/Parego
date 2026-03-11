"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, Clock, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

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
  onConfirm: () => void
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
  onCancel,
}: MatchResultSubmitterProps) {
  const [countdown, setCountdown] = useState<number | null>(null)
  const [selectedResult, setSelectedResult] = useState<"player1-win" | "draw" | "player2-win" | null>(null)
  const onConfirmRef = useRef(onConfirm)
  onConfirmRef.current = onConfirm

  // Start countdown when selection is made. Don't depend on onConfirm or the effect
  // would re-run every parent re-render and reset the timer so it never fires.
  useEffect(() => {
    if (!selectedResult || mySubmission?.confirmed) return
    setCountdown(10)
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer)
          onConfirmRef.current()
          return null
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [selectedResult, mySubmission?.confirmed])

  const handleSelect = (result: "player1-win" | "draw" | "player2-win") => {
    setSelectedResult(result)
    onSubmit(result)
  }

  const handleCancel = () => {
    setSelectedResult(null)
    setCountdown(null)
    onCancel()
  }

  const getResultText = (result: "player1-win" | "draw" | "player2-win") => {
    if (result === "draw") return "Draw"
    if (result === "player1-win") return `${player1Name} wins`
    return `${player2Name} wins`
  }

  // Check for conflict
  const hasConflict =
    mySubmission?.confirmed && opponentSubmission?.confirmed && mySubmission.result !== opponentSubmission.result

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="text-center">
          <h4 className="font-semibold text-lg mb-2">Submit Match Result</h4>
          <p className="text-sm text-muted-foreground">
            {player1Name} (White) vs {player2Name} (Black)
          </p>
        </div>

        {hasConflict && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Result Conflict!</strong>
              <br />
              You submitted: {getResultText(mySubmission.result)}
              <br />
              Opponent submitted: {getResultText(opponentSubmission!.result)}
              <br />
              <span className="text-xs mt-1 block">
                You can re-submit below, or the organizer will resolve this.
              </span>
            </AlertDescription>
          </Alert>
        )}

        {mySubmission?.confirmed && !hasConflict && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              You submitted: <strong>{getResultText(mySubmission.result)}</strong>
              {!opponentSubmission?.confirmed && (
                <>
                  <br />
                  Waiting for opponent to confirm...
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {opponentSubmission?.confirmed && !mySubmission?.confirmed && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your opponent has submitted a result. Please confirm or enter your result.
            </AlertDescription>
          </Alert>
        )}

        {countdown !== null && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-center gap-2 text-orange-600">
              <Clock className="h-4 w-4" />
              <span className="font-semibold">Confirming in {countdown}s</span>
            </div>
            <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => { onConfirmRef.current(); setCountdown(null); setSelectedResult(null); }}>
              Confirm now
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button
            variant={selectedResult === "player1-win" ? "default" : "outline"}
            className="w-full"
            onClick={() => handleSelect("player1-win")}
            disabled={mySubmission?.confirmed && !hasConflict}
          >
            {player1Name} wins (White)
          </Button>
          <Button
            variant={selectedResult === "draw" ? "default" : "outline"}
            className="w-full"
            onClick={() => handleSelect("draw")}
            disabled={mySubmission?.confirmed && !hasConflict}
          >
            Draw
          </Button>
          <Button
            variant={selectedResult === "player2-win" ? "default" : "outline"}
            className="w-full"
            onClick={() => handleSelect("player2-win")}
            disabled={mySubmission?.confirmed && !hasConflict}
          >
            {player2Name} wins (Black)
          </Button>
        </div>

        {countdown !== null && (
          <Button variant="outline" className="w-full bg-transparent" onClick={handleCancel}>
            Cancel (Change my mind)
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
