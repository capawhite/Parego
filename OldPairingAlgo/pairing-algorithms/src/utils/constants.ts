import { TournamentConfig, TieBreakSystem } from '../types/tournament';

/**
 * Default tournament configuration
 */
export const DEFAULT_TOURNAMENT_CONFIG: TournamentConfig = {
  pairing: {
    rematchPenalty: 1000,        // Penalty for pairing players who have played before
    colorBalanceWeight: 10,      // Weight for color balance considerations
    ratingDiffWeight: 0.01,      // Weight for rating differences
    waitingTimeWeight: 5,        // Weight for waiting time
    maxRatingDiff: 300,          // Maximum rating difference to consider
    teamPairingPenalty: 500,     // Penalty for pairing players from the same team
    pairingIntervalSeconds: 5    // How often to run the pairing algorithm
  },
  scoring: {
    winPoints: 1,                // Points for a win
    drawPoints: 0.5,             // Points for a draw
    lossPoints: 0,               // Points for a loss
    usePerformanceRating: true,  // Whether to use performance rating
    useStreaks: true,            // Whether to use streaks for bonus points
    streakBonus: 0.5             // Bonus points for a streak
  },
  timeControl: {
    initialTimeSeconds: 300,     // 5 minutes
    incrementSeconds: 3,
    allowBerserk: true
  },
  elimination: {
    isDoubleElimination: false,
    seedByRating: true,
    thirdPlaceMatch: false,
    randomizeSeeding: false
  },
  roundRobin: {
    isDoubleRoundRobin: false
  },
  tieBreaks: {
    systems: [
      TieBreakSystem.BUCHHOLZ,
      TieBreakSystem.MEDIAN_BUCHHOLZ,
      TieBreakSystem.SONNEBORN_BERGER,
      TieBreakSystem.DIRECT_ENCOUNTER,
      TieBreakSystem.WINS,
      TieBreakSystem.PERFORMANCE
    ]
  }
};
