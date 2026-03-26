/**
 * Tournament types supported by the system
 */
export enum TournamentType {
  /** Arena-style tournament where players can play multiple games */
  ARENA = 'arena',

  /** Swiss-style tournament with fixed number of rounds */
  SWISS = 'swiss',

  /** Round-robin tournament where each player plays against every other player */
  ROUND_ROBIN = 'round_robin',

  /** Elimination tournament (single or double) */
  ELIMINATION = 'elimination'
}

/**
 * Tie break systems supported by the system
 */
export enum TieBreakSystem {
  /** Sum of opponent scores */
  BUCHHOLZ = 'buchholz',

  /** Sum of opponent scores, excluding best and worst */
  MEDIAN_BUCHHOLZ = 'median_buchholz',

  /** Sum of progressive scores */
  PROGRESSIVE = 'progressive',

  /** Head-to-head results */
  DIRECT_ENCOUNTER = 'direct_encounter',

  /** Number of wins */
  WINS = 'wins',

  /** Performance rating */
  PERFORMANCE = 'performance',

  /** Sonneborn-Berger score (sum of the scores of the opponents a player has defeated, plus half the scores of the opponents with whom the player has drawn) */
  SONNEBORN_BERGER = 'sonneborn_berger'
}

/**
 * Tournament status
 */
export enum TournamentStatus {
  /** Tournament is created but not started */
  CREATED = 'created',

  /** Tournament is currently running */
  RUNNING = 'running',

  /** Tournament is paused */
  PAUSED = 'paused',

  /** Tournament is finished */
  FINISHED = 'finished',

  /** Tournament is cancelled */
  CANCELLED = 'cancelled'
}

/**
 * Tournament configuration
 */
export interface TournamentConfig {
  /** Pairing algorithm parameters */
  pairing: {
    /** Penalty for pairing players who have played before */
    rematchPenalty: number;

    /** Weight for color balance considerations */
    colorBalanceWeight: number;

    /** Weight for rating differences */
    ratingDiffWeight: number;

    /** Weight for waiting time */
    waitingTimeWeight: number;

    /** Maximum rating difference to consider (for performance) */
    maxRatingDiff: number;

    /** Penalty for pairing players from the same team */
    teamPairingPenalty: number;

    /** How often to run the pairing algorithm (in seconds) */
    pairingIntervalSeconds: number;
  };

  /** Scoring configuration */
  scoring: {
    /** Points for a win */
    winPoints: number;

    /** Points for a draw */
    drawPoints: number;

    /** Points for a loss */
    lossPoints: number;

    /** Whether to use performance rating */
    usePerformanceRating: boolean;

    /** Whether to use streaks for bonus points */
    useStreaks: boolean;

    /** Bonus points for a streak */
    streakBonus?: number;
  };

  /** Time control configuration */
  timeControl?: {
    /** Initial time in seconds */
    initialTimeSeconds: number;

    /** Increment in seconds */
    incrementSeconds: number;

    /** Whether to allow berserking (halving time for bonus points) */
    allowBerserk: boolean;
  };

  /** Elimination tournament configuration */
  elimination?: {
    /** Whether to use double elimination format */
    isDoubleElimination: boolean;

    /** Whether to seed players by rating */
    seedByRating: boolean;

    /** Whether to have a third-place match */
    thirdPlaceMatch: boolean;

    /** Whether to randomize seeding within rating groups */
    randomizeSeeding: boolean;
  };

  /** Round Robin tournament configuration */
  roundRobin?: {
    /** Whether to use double round-robin format (each player plays every other player twice) */
    isDoubleRoundRobin: boolean;
  };

  /** Tie break configuration */
  tieBreaks?: {
    /** List of tie break systems to use, in order of priority */
    systems: TieBreakSystem[];
  };
}

/**
 * Represents a tournament
 */
export interface Tournament {
  /** Unique identifier for the tournament */
  id: string;

  /** Tournament name */
  name: string;

  /** Tournament description */
  description?: string;

  /** Tournament type */
  type: TournamentType;

  /** Tournament status */
  status: TournamentStatus;

  /** Tournament configuration */
  config: TournamentConfig;

  /** Timestamp when the tournament was created (milliseconds since epoch) */
  createdAt: number;

  /** Timestamp when the tournament started (milliseconds since epoch) */
  startTime?: number;

  /** Timestamp when the tournament is scheduled to end (milliseconds since epoch) */
  endTime?: number;

  /** Duration of the tournament in minutes */
  durationMinutes?: number;

  /** Number of rounds for Swiss and Round Robin tournaments */
  rounds?: number;

  /** Current round */
  currentRound?: number;

  /** Minimum rating allowed */
  minRating?: number;

  /** Maximum rating allowed */
  maxRating?: number;

  /** Whether the tournament is private */
  isPrivate: boolean;

  /** Password for private tournaments */
  password?: string;

  /** ID of the tournament organizer */
  organizerId: string;
}
