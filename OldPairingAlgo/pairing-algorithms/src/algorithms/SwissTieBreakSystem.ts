import { Player } from '../models/Player';
import { Pairing } from '../models/Pairing';
import { Result } from '../types/pairing';
import { TieBreakSystem } from '../types/tournament';
import { PlayerWithStats } from '../types/player';

/**
 * Swiss tournament tie-break system
 * Implements various tie-break methods for Swiss tournaments
 */
export class SwissTieBreakSystem {
  private players: Map<string, Player>;
  private pairings: Pairing[];
  private countByesAsDraw: boolean;

  /**
   * Create a new Swiss tie-break system
   * @param players - Map of players in the tournament
   * @param pairings - List of all pairings in the tournament
   * @param countByesAsDraw - Whether to count byes as draws (true) or wins (false)
   */
  constructor(
    players: Map<string, Player>,
    pairings: Pairing[],
    countByesAsDraw: boolean = true
  ) {
    this.players = players;
    this.pairings = pairings;
    this.countByesAsDraw = countByesAsDraw;
  }

  /**
   * Calculate tie break scores for a player
   * @param player - The player
   * @returns The tie break scores
   */
  public calculateTieBreaks(player: Player): PlayerWithStats['tiebreaks'] {
    return {
      buchholz: this.calculateBuchholz(player),
      medianBuchholz: this.calculateMedianBuchholz(player),
      progressive: this.calculateProgressive(player),
      directEncounter: this.calculateDirectEncounter(player),
      wins: this.calculateWins(player),
      sonnebornBerger: this.calculateSonnebornBerger(player)
    };
  }

  /**
   * Compare two players based on a specific tie break system
   * @param a - The first player
   * @param b - The second player
   * @param system - The tie break system to use
   * @returns Negative if a is better, positive if b is better, 0 if equal
   */
  public compareTieBreak(a: PlayerWithStats, b: PlayerWithStats, system: TieBreakSystem): number {
    switch (system) {
      case TieBreakSystem.BUCHHOLZ:
        return (b.tiebreaks?.buchholz || 0) - (a.tiebreaks?.buchholz || 0);

      case TieBreakSystem.MEDIAN_BUCHHOLZ:
        return (b.tiebreaks?.medianBuchholz || 0) - (a.tiebreaks?.medianBuchholz || 0);

      case TieBreakSystem.PROGRESSIVE:
        return (b.tiebreaks?.progressive || 0) - (a.tiebreaks?.progressive || 0);

      case TieBreakSystem.DIRECT_ENCOUNTER:
        return (b.tiebreaks?.directEncounter || 0) - (a.tiebreaks?.directEncounter || 0);

      case TieBreakSystem.WINS:
        return (b.tiebreaks?.wins || 0) - (a.tiebreaks?.wins || 0);

      case TieBreakSystem.PERFORMANCE:
        return (b.performanceRating || 0) - (a.performanceRating || 0);

      case TieBreakSystem.SONNEBORN_BERGER:
        return (b.tiebreaks?.sonnebornBerger || 0) - (a.tiebreaks?.sonnebornBerger || 0);

      default:
        return 0;
    }
  }

  /**
   * Calculate Buchholz score (sum of opponent scores)
   * @param player - The player
   * @returns The Buchholz score
   */
  private calculateBuchholz(player: Player): number {
    let buchholz = 0;
    const playerPairings = this.getPlayerPairings(player.id);

    for (const pairing of playerPairings) {
      // Handle bye differently based on configuration
      if (pairing.result === Result.BYE) {
        // If counting byes as draws, add the average score of all players
        if (this.countByesAsDraw) {
          buchholz += this.getAveragePlayerScore();
        }
        continue;
      }

      const opponentId = pairing.whiteId === player.id ? pairing.blackId : pairing.whiteId;
      const opponent = this.players.get(opponentId);

      if (opponent) {
        buchholz += opponent.score;
      }
    }

    return buchholz;
  }

  /**
   * Calculate Median Buchholz score (sum of opponent scores excluding best and worst)
   * @param player - The player
   * @returns The Median Buchholz score
   */
  private calculateMedianBuchholz(player: Player): number {
    const opponentScores: number[] = [];
    const playerPairings = this.getPlayerPairings(player.id);

    for (const pairing of playerPairings) {
      // Handle bye differently based on configuration
      if (pairing.result === Result.BYE) {
        // If counting byes as draws, add the average score of all players
        if (this.countByesAsDraw) {
          opponentScores.push(this.getAveragePlayerScore());
        }
        continue;
      }

      const opponentId = pairing.whiteId === player.id ? pairing.blackId : pairing.whiteId;
      const opponent = this.players.get(opponentId);

      if (opponent) {
        opponentScores.push(opponent.score);
      }
    }

    // If player has 0 or 1 opponents, return regular Buchholz
    if (opponentScores.length <= 1) {
      return this.calculateBuchholz(player);
    }

    // Sort scores and remove best and worst
    opponentScores.sort((a, b) => a - b);
    opponentScores.shift(); // Remove lowest score
    opponentScores.pop();   // Remove highest score

    // Sum remaining scores
    return opponentScores.reduce((sum, score) => sum + score, 0);
  }

  /**
   * Calculate Progressive score (sum of progressive scores)
   * @param player - The player
   * @returns The Progressive score
   */
  private calculateProgressive(player: Player): number {
    let progressive = 0;
    let cumulativeScore = 0;
    const rounds = this.getMaxRound();
    
    for (let round = 1; round <= rounds; round++) {
      const roundScore = this.getPlayerScoreInRound(player.id, round);
      cumulativeScore += roundScore;
      progressive += cumulativeScore;
    }
    
    return progressive;
  }

  /**
   * Calculate Direct Encounter score (points against tied players)
   * @param player - The player
   * @returns The Direct Encounter score
   */
  private calculateDirectEncounter(player: Player): number {
    let directEncounter = 0;
    const tiedPlayers = this.getTiedPlayers(player);
    const playerPairings = this.getPlayerPairings(player.id);

    for (const pairing of playerPairings) {
      // Skip byes
      if (pairing.result === Result.BYE) {
        continue;
      }

      const opponentId = pairing.whiteId === player.id ? pairing.blackId : pairing.whiteId;
      
      // Check if this opponent is tied with the player
      if (!tiedPlayers.includes(opponentId)) {
        continue;
      }

      // Add points from this game
      if ((pairing.result === Result.WHITE_WIN && pairing.whiteId === player.id) ||
          (pairing.result === Result.BLACK_WIN && pairing.blackId === player.id)) {
        directEncounter += 1;
      } else if (pairing.result === Result.DRAW) {
        directEncounter += 0.5;
      }
    }

    return directEncounter;
  }

  /**
   * Calculate number of wins
   * @param player - The player
   * @returns The number of wins
   */
  private calculateWins(player: Player): number {
    let wins = 0;
    const playerPairings = this.getPlayerPairings(player.id);

    for (const pairing of playerPairings) {
      // Handle bye differently based on configuration
      if (pairing.result === Result.BYE) {
        // If counting byes as wins, increment wins
        if (!this.countByesAsDraw) {
          wins += 1;
        }
        continue;
      }

      // Count regular wins
      if ((pairing.result === Result.WHITE_WIN && pairing.whiteId === player.id) ||
          (pairing.result === Result.BLACK_WIN && pairing.blackId === player.id)) {
        wins += 1;
      }
    }

    return wins;
  }

  /**
   * Calculate Sonneborn-Berger score
   * @param player - The player
   * @returns The Sonneborn-Berger score
   */
  private calculateSonnebornBerger(player: Player): number {
    let sonnebornBerger = 0;
    const playerPairings = this.getPlayerPairings(player.id);

    for (const pairing of playerPairings) {
      // Handle bye differently based on configuration
      if (pairing.result === Result.BYE) {
        // If counting byes as draws, add half the average score
        if (this.countByesAsDraw) {
          sonnebornBerger += this.getAveragePlayerScore() / 2;
        }
        continue;
      }

      const opponentId = pairing.whiteId === player.id ? pairing.blackId : pairing.whiteId;
      const opponent = this.players.get(opponentId);

      if (!opponent) {
        continue;
      }

      // Add opponent's score if player won
      if ((pairing.result === Result.WHITE_WIN && pairing.whiteId === player.id) ||
          (pairing.result === Result.BLACK_WIN && pairing.blackId === player.id)) {
        sonnebornBerger += opponent.score;
      }
      // Add half of opponent's score if draw
      else if (pairing.result === Result.DRAW) {
        sonnebornBerger += opponent.score / 2;
      }
    }

    return sonnebornBerger;
  }

  /**
   * Get all pairings for a player
   * @param playerId - The player ID
   * @returns List of pairings involving the player
   */
  private getPlayerPairings(playerId: string): Pairing[] {
    return this.pairings.filter(pairing => 
      pairing.whiteId === playerId || pairing.blackId === playerId
    );
  }

  /**
   * Get the average score of all players
   * @returns The average player score
   */
  private getAveragePlayerScore(): number {
    if (this.players.size === 0) {
      return 0;
    }

    let totalScore = 0;
    for (const player of this.players.values()) {
      totalScore += player.score;
    }

    return totalScore / this.players.size;
  }

  /**
   * Get the maximum round number in the tournament
   * @returns The maximum round number
   */
  private getMaxRound(): number {
    let maxRound = 0;
    for (const pairing of this.pairings) {
      if (pairing.round && pairing.round > maxRound) {
        maxRound = pairing.round;
      }
    }
    return maxRound;
  }

  /**
   * Get a player's score in a specific round
   * @param playerId - The player ID
   * @param round - The round number
   * @returns The player's score in the round
   */
  private getPlayerScoreInRound(playerId: string, round: number): number {
    const roundPairings = this.pairings.filter(pairing => 
      pairing.round === round && (pairing.whiteId === playerId || pairing.blackId === playerId)
    );

    if (roundPairings.length === 0) {
      return 0;
    }

    const pairing = roundPairings[0];

    // Handle bye
    if (pairing.result === Result.BYE) {
      return this.countByesAsDraw ? 0.5 : 1;
    }

    // Handle regular game
    if ((pairing.result === Result.WHITE_WIN && pairing.whiteId === playerId) ||
        (pairing.result === Result.BLACK_WIN && pairing.blackId === playerId)) {
      return 1;
    } else if (pairing.result === Result.DRAW) {
      return 0.5;
    }

    return 0;
  }

  /**
   * Get players tied with the given player
   * @param player - The player
   * @returns List of player IDs tied with the given player
   */
  private getTiedPlayers(player: Player): string[] {
    const tiedPlayers: string[] = [];
    
    for (const [id, otherPlayer] of this.players.entries()) {
      if (id !== player.id && otherPlayer.score === player.score) {
        tiedPlayers.push(id);
      }
    }
    
    return tiedPlayers;
  }
}
