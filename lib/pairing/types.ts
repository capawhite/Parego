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
   * Create pairings for available players.
   * @param totalPlayers - Optional total players in tournament (used e.g. by Arena for dynamic rematch rules).
   */
  createPairings(
    availablePlayers: Player[],
    allHistoricalMatches: Match[],
    settings: TournamentSettings,
    maxMatches?: number,
    totalPlayers?: number,
    options?: {
      /** Arena override used by organizer force-pair action. */
      skipT1?: boolean
    },
  ): Match[]

  /**
   * Determine if auto-pairing should trigger.
   * @param allHistoricalMatches - Used by Arena for T1 eligibility; other algorithms may ignore.
   */
  shouldPair(
    availablePlayers: Player[],
    activeMatches: Match[],
    totalPlayers: number,
    availableTables: number,
    settings: TournamentSettings,
    allHistoricalMatches: Match[],
  ): boolean

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
