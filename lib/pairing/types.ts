import type { Player, Match, TournamentSettings } from "@/lib/types"

/**
 * Base interface that all pairing algorithms must implement
 */
export interface PairingAlgorithm {
  /**
   * Unique identifier for the algorithm
   */
  id: string

  /**
   * Display name for the algorithm
   */
  name: string

  /**
   * Description of how the algorithm works
   */
  description: string

  /**
   * Create pairings for available players
   */
  createPairings(
    availablePlayers: Player[],
    allHistoricalMatches: Match[],
    settings: TournamentSettings,
    maxMatches?: number,
  ): Match[]

  /**
   * Determine if auto-pairing should trigger
   */
  shouldPair(availablePlayers: Player[], activeMatches: Match[], totalPlayers: number, availableTables: number): boolean

  /**
   * Get polling interval in milliseconds
   */
  getPollingInterval(): number

  /**
   * Validate settings for this algorithm
   */
  validateSettings?(settings: TournamentSettings): { valid: boolean; errors: string[] }
}

/**
 * Algorithm-specific state that can be stored in ArenaState
 */
export interface AlgorithmState {
  [key: string]: any
}
