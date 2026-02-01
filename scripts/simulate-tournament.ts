/**
 * Tournament Simulator Script
 *
 * This script simulates a tournament by automatically entering random results
 * for active matches at intervals. Useful for testing pairing algorithms.
 *
 * Usage: Run this in the browser console or as a Node script
 */

interface SimulationConfig {
  tournamentId: string
  // Interval between entering results (milliseconds)
  resultInterval: number
  // How many results to enter per interval
  resultsPerInterval: number
  // Stop after N results (0 = unlimited)
  maxResults: number
}

class TournamentSimulator {
  private config: SimulationConfig
  private resultsEntered = 0
  private intervalId: NodeJS.Timeout | null = null

  constructor(config: SimulationConfig) {
    this.config = config
  }

  start() {
    console.log("[Simulator] Starting tournament simulation...")
    console.log("[Simulator] Config:", this.config)

    this.intervalId = setInterval(() => {
      this.simulateResults()
    }, this.config.resultInterval)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log("[Simulator] Stopped. Total results entered:", this.resultsEntered)
    }
  }

  private simulateResults() {
    // Get active matches from the UI
    const activeMatchCards = document.querySelectorAll('[data-match-active="true"]')

    if (activeMatchCards.length === 0) {
      console.log("[Simulator] No active matches found")
      return
    }

    console.log(`[Simulator] Found ${activeMatchCards.length} active matches`)

    // Enter results for up to N matches
    const toProcess = Math.min(this.config.resultsPerInterval, activeMatchCards.length)

    for (let i = 0; i < toProcess; i++) {
      const matchCard = activeMatchCards[i]

      // Find the result buttons (White Wins, Draw, Black Wins)
      const buttons = matchCard.querySelectorAll("button")
      const resultButtons = Array.from(buttons).filter(
        (btn) => btn.textContent?.includes("Wins") || btn.textContent?.includes("Draw"),
      )

      if (resultButtons.length === 3) {
        // Randomly pick a result: 0=White, 1=Draw, 2=Black
        // Weight: 45% white, 10% draw, 45% black
        const random = Math.random()
        const buttonIndex = random < 0.45 ? 0 : random < 0.55 ? 1 : 2

        const button = resultButtons[buttonIndex] as HTMLButtonElement
        console.log(`[Simulator] Clicking: ${button.textContent}`)
        button.click()

        this.resultsEntered++

        // Check if we should stop
        if (this.config.maxResults > 0 && this.resultsEntered >= this.config.maxResults) {
          console.log("[Simulator] Max results reached")
          this.stop()
          return
        }
      }
    }
  }
}

// Example usage (paste in browser console):
// const sim = new TournamentSimulator({
//   tournamentId: 'YOUR_TOURNAMENT_ID',
//   resultInterval: 3000,      // Enter results every 3 seconds
//   resultsPerInterval: 2,     // Enter 2 results at a time
//   maxResults: 50             // Stop after 50 results (0 = unlimited)
// })
// sim.start()
//
// To stop manually: sim.stop()

export { TournamentSimulator, type SimulationConfig }
