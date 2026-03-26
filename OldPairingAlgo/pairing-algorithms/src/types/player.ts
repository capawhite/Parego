/**
 * Represents a player in the tournament system
 */
export interface Player {
  /** Unique identifier for the player */
  id: string;

  /** Player's display name */
  name: string;

  /** Player's rating (e.g., Elo, Glicko) */
  rating: number;

  /** Optional team affiliation */
  team?: string;

  /** Current score in the tournament */
  score: number;

  /** Number of games played in the tournament */
  gamesPlayed: number;

  /** Whether the player is active in the tournament */
  isActive: boolean;

  /** Whether the player is waiting for a game */
  isWaiting: boolean;

  /** Timestamp when the player started waiting (milliseconds since epoch) */
  waitingSince: number;

  /** Number of games played as white */
  whiteCount: number;

  /** Number of games played as black */
  blackCount: number;

  /** Current streak (positive for wins, negative for losses, 0 for no streak) */
  currentStreak: number;

  /** IDs of previous opponents */
  previousOpponents: string[];

  /** Tiebreak scores */
  tiebreaks?: Record<string, number>;
}

/**
 * Player with additional data for tournament display
 */
export interface PlayerWithStats extends Player {
  /** Performance rating in the tournament */
  performanceRating?: number;

  /** Average opponent rating */
  averageOpponentRating?: number;

  /** Tiebreak scores */
  tiebreaks: Record<string, number>;
}

/**
 * Player creation request
 */
export interface CreatePlayerRequest {
  name: string;
  rating: number;
  team?: string;
}

/**
 * Player update request
 */
export interface UpdatePlayerRequest {
  name?: string;
  rating?: number;
  team?: string;
  isActive?: boolean;
}
