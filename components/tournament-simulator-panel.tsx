"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Play, Square } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"

export function TournamentSimulatorPanel() {
  const { t } = useI18n()
  const [isRunning, setIsRunning] = useState(false)
  const [resultsEntered, setResultsEntered] = useState(0)
  const [intervalMs, setIntervalMs] = useState(3000)
  const [batchSize, setBatchSize] = useState(2)
  const [maxResults, setMaxResults] = useState(50)
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null)
  const resultsEnteredRef = useRef(0)
  const isRunningRef = useRef(false)

  const simulateResults = () => {
    if (!isRunningRef.current) {
      return
    }

    const allButtons = Array.from(document.querySelectorAll("button"))
    const resultButtons = allButtons.filter((btn) => {
      const dataResult = btn.getAttribute("data-simulator-result")
      if (dataResult === "white" || dataResult === "draw" || dataResult === "black") return true
      const text = btn.textContent?.trim()
      return text === "White Wins" || text === "Draw" || text === "Black Wins"
    })

    if (process.env.NODE_ENV === "development")
      console.log(`[v0] Simulator found ${resultButtons.length} result buttons`)

    if (resultButtons.length === 0) {
      if (process.env.NODE_ENV === "development")
        console.log("[v0] Simulator: No active matches found, stopping")
      stopSimulation()
      return
    }

    // Group buttons by match (3 buttons per match)
    const matches = []
    for (let i = 0; i < resultButtons.length; i += 3) {
      if (resultButtons[i + 2]) {
        matches.push([resultButtons[i], resultButtons[i + 1], resultButtons[i + 2]])
      }
    }

    if (process.env.NODE_ENV === "development")
      console.log(`[v0] Simulator: Found ${matches.length} active matches`)

    // Process up to batchSize matches
    const toProcess = Math.min(batchSize, matches.length)

    for (let i = 0; i < toProcess; i++) {
      const matchButtons = matches[i]
      // Random result: 45% white wins, 10% draw, 45% black wins
      const random = Math.random()
      const buttonIndex = random < 0.45 ? 0 : random < 0.55 ? 1 : 2
      const button = matchButtons[buttonIndex] as HTMLButtonElement

      if (process.env.NODE_ENV === "development")
        console.log(`[v0] Simulator: Clicking ${button.textContent}`)
      button.click()

      resultsEnteredRef.current += 1
      setResultsEntered((prev) => prev + 1)

      if (maxResults > 0 && resultsEnteredRef.current >= maxResults) {
        if (process.env.NODE_ENV === "development")
          console.log(`[v0] Simulator: Reached max results (${maxResults})`)
        isRunningRef.current = false
        stopSimulation()
        return
      }
    }
  }

  const startSimulation = () => {
    if (process.env.NODE_ENV === "development") console.log("[v0] Simulator: Starting...")
    setIsRunning(true)
    isRunningRef.current = true
    resultsEnteredRef.current = 0
    setResultsEntered(0)

    // Run immediately once
    simulateResults()

    // Then set interval
    const id = setInterval(() => {
      simulateResults()
    }, intervalMs)

    setIntervalId(id)
  }

  const stopSimulation = () => {
    if (process.env.NODE_ENV === "development") console.log("[v0] Simulator: Stopping...")
    isRunningRef.current = false
    if (intervalId) {
      clearInterval(intervalId)
      setIntervalId(null)
    }
    setIsRunning(false)
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          {t("arena.simulatorTitle")}
        </CardTitle>
        <CardDescription>{t("arena.simulatorDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="interval">{t("arena.simulatorIntervalLabel")}</Label>
          <Input
            id="interval"
            type="number"
            value={String(intervalMs ?? 3000)}
            onChange={(e) => {
              const val = Number.parseInt(e.target.value, 10)
              setIntervalMs(isNaN(val) ? 3000 : val)
            }}
            disabled={isRunning}
            min={500}
            max={10000}
          />
          <p className="text-xs text-muted-foreground">{t("arena.simulatorIntervalHelp")}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="batchSize">{t("arena.simulatorResultsPerInterval")}</Label>
          <Input
            id="batchSize"
            type="number"
            value={String(batchSize ?? 2)}
            onChange={(e) => {
              const val = Number.parseInt(e.target.value, 10)
              setBatchSize(isNaN(val) ? 2 : val)
            }}
            disabled={isRunning}
            min={1}
            max={10}
          />
          <p className="text-xs text-muted-foreground">{t("arena.simulatorBatchHelp")}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxResults">{t("arena.simulatorMaxResults")}</Label>
          <Input
            id="maxResults"
            type="number"
            value={String(maxResults ?? 50)}
            onChange={(e) => {
              const val = Number.parseInt(e.target.value, 10)
              setMaxResults(isNaN(val) ? 50 : val)
            }}
            disabled={isRunning}
            min={0}
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            <p className="text-sm font-medium">{t("arena.simulatorResultsEnteredLabel")}</p>
            <p className="text-2xl font-bold">{resultsEntered}</p>
          </div>

          {!isRunning ? (
            <Button onClick={startSimulation} size="lg">
              <Play className="h-4 w-4 mr-2" />
              {t("arena.simulatorStart")}
            </Button>
          ) : (
            <Button onClick={stopSimulation} variant="destructive" size="lg">
              <Square className="h-4 w-4 mr-2" />
              {t("arena.simulatorStop")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
