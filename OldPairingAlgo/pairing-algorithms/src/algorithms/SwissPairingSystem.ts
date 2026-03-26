import { TournamentConfig, TieBreakSystem } from '../types/tournament';
import { Player } from '../models/Player';
import { Pairing } from '../models/Pairing';
import { Result } from '../types/pairing';
import { PlayerWithStats } from '../types/player';
import { SwissTieBreakSystem } from './SwissTieBreakSystem';

/**
 * Represents a potential pairing between two players with a score
 */
interface PotentialPairing {
  whiteId: string;
  blackId: string;
  score: number;
}

/**
 * Swiss pairing system for tournaments with fixed number of rounds
 * In Swiss tournaments, players with similar scores are paired together
 */
export class SwissPairingSystem {
  private players: Map<string, Player> = new Map();
  private activePairings: Pairing[] = [];
  private finishedPairings: Pairing[] = [];
  private config: TournamentConfig;
  private tournamentId: string;
  private currentRound: number = 0;
  private playersWithByes: Map<string, number> = new Map(); // Maps player ID to number of byes received
  private byeHistory: Map<number, string> = new Map(); // Maps round number to player ID who got a bye

  constructor(tournamentId: string, config: TournamentConfig) {
    this.tournamentId = tournamentId;
    this.config = config;
  }

  /**
   * Add a player to the tournament
   * @param {Player} player - The player to add
   * @returns {boolean} Whether the player was added
   */
  addPlayer(player: Player): boolean {
    if (this.players.has(player.id)) {
      return false;
    }
    this.players.set(player.id, player);
    return true;
  }

  /**
   * Remove a player from the tournament
   * @param {string} playerId - The ID of the player to remove
   * @returns {boolean} Whether the player was removed
   */
  removePlayer(playerId: string): boolean {
    return this.players.delete(playerId);
  }

  /**
   * Get a player by ID
   * @param {string} playerId - The ID of the player to get
   * @returns {Player | undefined} The player, or undefined if not found
   */
  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  /**
   * Get all active players
   * @returns {Player[]} The active players
   */
  getActivePlayers(): Player[] {
    return Array.from(this.players.values()).filter(player => player.isActive);
  }

  /**
   * Start a new round of pairings
   * @returns {Pairing[]} The created pairings
   */
  startNewRound(): Pairing[] {
    // Increment round number
    this.currentRound++;

    // Get all active players
    const activePlayers = this.getActivePlayers();

    // Sort players by score (descending)
    activePlayers.sort((a, b) => b.score - a.score);

    // Create potential pairings
    const potentialPairings = this.generatePotentialPairings(activePlayers);

    // Sort by score (higher is better)
    potentialPairings.sort((a, b) => b.score - a.score);

    // Create pairings using a greedy algorithm
    const newPairings: Pairing[] = [];
    const pairedPlayers = new Set<string>();

    for (const potential of potentialPairings) {
      // Skip if either player is already paired
      if (pairedPlayers.has(potential.whiteId) || pairedPlayers.has(potential.blackId)) {
        continue;
      }

      // Create the pairing
      const pairing = new Pairing({
        tournamentId: this.tournamentId,
        whiteId: potential.whiteId,
        blackId: potential.blackId,
        round: this.currentRound,
        boardNumber: newPairings.length + 1
      });

      // Add to pairings
      newPairings.push(pairing);
      this.activePairings.push(pairing);

      // Mark players as paired
      pairedPlayers.add(potential.whiteId);
      pairedPlayers.add(potential.blackId);

      // Update color counts
      const whitePlayer = this.players.get(potential.whiteId);
      const blackPlayer = this.players.get(potential.blackId);

      if (whitePlayer) {
        whitePlayer.incrementWhiteCount();
      }

      if (blackPlayer) {
        blackPlayer.incrementBlackCount();
      }
    }

    // Handle odd number of players (one player gets a bye)
    if (activePlayers.length % 2 !== 0) {
      // Find players who haven't been paired yet
      const unpaired = activePlayers.filter(player => !pairedPlayers.has(player.id));

      // Get the player who should receive a bye
      const byePlayer = this.selectPlayerForBye(unpaired);

      if (byePlayer) {
        // Award a bye (counts as a draw instead of a win)
        byePlayer.addScore(this.config.scoring.drawPoints);

        // Record that this player has received a bye
        const byeCount = this.playersWithByes.get(byePlayer.id) || 0;
        this.playersWithByes.set(byePlayer.id, byeCount + 1);

        // Record which player got a bye in this round
        this.byeHistory.set(this.currentRound, byePlayer.id);

        // Create a "bye pairing" to track the bye in the tournament history
        // This is useful for visualization and reporting
        this.createByePairing(byePlayer.id);
      }
    }

    return newPairings;
  }

  /**
   * Generate potential pairings between players
   * @param {Player[]} players - The players to pair
   * @returns {PotentialPairing[]} The potential pairings
   */
  private generatePotentialPairings(players: Player[]): PotentialPairing[] {
    const potentialPairings: PotentialPairing[] = [];

    // Group players by score
    const playersByScore = new Map<number, Player[]>();

    for (const player of players) {
      if (!playersByScore.has(player.score)) {
        playersByScore.set(player.score, []);
      }
      playersByScore.get(player.score)!.push(player);
    }

    // Sort scores in descending order
    const scores = Array.from(playersByScore.keys()).sort((a, b) => b - a);

    // Generate pairings within each score group first
    for (const score of scores) {
      const playersWithScore = playersByScore.get(score)!;

      // Generate pairings within this score group
      this.generatePairingsForGroup(playersWithScore, potentialPairings);

      // Remove paired players from the group
      const remainingPlayers = playersWithScore.filter(
        player => !potentialPairings.some(
          pairing => pairing.whiteId === player.id || pairing.blackId === player.id
        )
      );

      playersByScore.set(score, remainingPlayers);
    }

    // If there are still unpaired players, pair across score groups
    for (let i = 0; i < scores.length - 1; i++) {
      const higherScore = scores[i];
      const lowerScore = scores[i + 1];

      const higherPlayers = playersByScore.get(higherScore)!;
      const lowerPlayers = playersByScore.get(lowerScore)!;

      if (higherPlayers.length > 0 && lowerPlayers.length > 0) {
        // Pair players from different score groups
        for (const player1 of higherPlayers) {
          for (const player2 of lowerPlayers) {
            // Skip if players have played against each other
            if (player1.hasPlayedAgainst(player2.id)) {
              continue;
            }

            // Calculate pairing score
            const score = this.calculatePairingScore(player1, player2);

            // Determine colors
            let whiteId: string;
            let blackId: string;

            if (player1.getColorBalance() < player2.getColorBalance()) {
              // Player 1 should be white
              whiteId = player1.id;
              blackId = player2.id;
            } else {
              // Player 2 should be white
              whiteId = player2.id;
              blackId = player1.id;
            }

            potentialPairings.push({ whiteId, blackId, score });
          }
        }
      }
    }

    return potentialPairings;
  }

  /**
   * Generate pairings within a group of players with the same score
   * @param {Player[]} players - The players to pair
   * @param {PotentialPairing[]} potentialPairings - The array to add pairings to
   */
  private generatePairingsForGroup(players: Player[], potentialPairings: PotentialPairing[]): void {
    for (let i = 0; i < players.length; i++) {
      const player1 = players[i];

      for (let j = i + 1; j < players.length; j++) {
        const player2 = players[j];

        // Skip if players have played against each other
        if (player1.hasPlayedAgainst(player2.id)) {
          continue;
        }

        // Skip if players are from the same team and team pairing is penalized
        if (player1.team && player2.team && player1.team === player2.team && this.config.pairing.teamPairingPenalty > 0) {
          continue;
        }

        // Calculate pairing score
        const score = this.calculatePairingScore(player1, player2);

        // Determine colors
        let whiteId: string;
        let blackId: string;

        if (player1.getColorBalance() < player2.getColorBalance()) {
          // Player 1 should be white
          whiteId = player1.id;
          blackId = player2.id;
        } else if (player1.getColorBalance() > player2.getColorBalance()) {
          // Player 2 should be white
          whiteId = player2.id;
          blackId = player1.id;
        } else {
          // Random assignment if color balance is equal
          if (Math.random() < 0.5) {
            whiteId = player1.id;
            blackId = player2.id;
          } else {
            whiteId = player2.id;
            blackId = player1.id;
          }
        }

        potentialPairings.push({ whiteId, blackId, score });
      }
    }
  }

  /**
   * Calculate a score for a potential pairing
   * @param {Player} player1 - The first player
   * @param {Player} player2 - The second player
   * @returns {number} The pairing score (higher is better)
   */
  private calculatePairingScore(player1: Player, player2: Player): number {
    let score = 1000; // Base score

    // Penalize rating difference
    const ratingDiff = Math.abs(player1.rating - player2.rating);
    if (ratingDiff > this.config.pairing.maxRatingDiff) {
      score -= ratingDiff * this.config.pairing.ratingDiffWeight * 2;
    } else {
      score -= ratingDiff * this.config.pairing.ratingDiffWeight;
    }

    // Penalize rematch
    if (player1.hasPlayedAgainst(player2.id)) {
      score -= this.config.pairing.rematchPenalty;
    }

    // Penalize team pairing
    if (player1.team && player2.team && player1.team === player2.team) {
      score -= this.config.pairing.teamPairingPenalty;
    }

    // Bonus for similar scores
    const scoreDiff = Math.abs(player1.score - player2.score);
    score -= scoreDiff * 10;

    // Bonus for color balance
    const colorBalance1 = player1.getColorBalance();
    const colorBalance2 = player2.getColorBalance();

    if (colorBalance1 < 0 && colorBalance2 > 0) {
      // Player 1 should be white, Player 2 should be black
      score += Math.abs(colorBalance1) * this.config.pairing.colorBalanceWeight;
      score += Math.abs(colorBalance2) * this.config.pairing.colorBalanceWeight;
    } else if (colorBalance1 > 0 && colorBalance2 < 0) {
      // Player 1 should be black, Player 2 should be white
      score += Math.abs(colorBalance1) * this.config.pairing.colorBalanceWeight;
      score += Math.abs(colorBalance2) * this.config.pairing.colorBalanceWeight;
    }

    return score;
  }

  /**
   * Finish a game with the given result
   * @param {number} pairingIndex - The index of the pairing in the active pairings
   * @param {Result} result - The result of the game
   * @returns {boolean} Whether the game was finished
   */
  finishGame(pairingIndex: number, result: Result): boolean {
    if (pairingIndex < 0 || pairingIndex >= this.activePairings.length) {
      return false;
    }

    const pairing = this.activePairings[pairingIndex];
    pairing.setResult(result);

    const whitePlayer = this.players.get(pairing.whiteId);
    const blackPlayer = this.players.get(pairing.blackId);

    if (whitePlayer && blackPlayer) {
      // Add opponents to history
      whitePlayer.addOpponent(blackPlayer.id);
      blackPlayer.addOpponent(whitePlayer.id);

      // Update scores
      if (result === Result.WHITE_WIN) {
        whitePlayer.addScore(this.config.scoring.winPoints);
        blackPlayer.addScore(this.config.scoring.lossPoints);
      } else if (result === Result.BLACK_WIN) {
        whitePlayer.addScore(this.config.scoring.lossPoints);
        blackPlayer.addScore(this.config.scoring.winPoints);
      } else if (result === Result.DRAW) {
        whitePlayer.addScore(this.config.scoring.drawPoints);
        blackPlayer.addScore(this.config.scoring.drawPoints);
      }
    }

    // Move pairing to finished pairings
    this.activePairings.splice(pairingIndex, 1);
    this.finishedPairings.push(pairing);

    return true;
  }

  /**
   * Get the standings for the tournament
   * @param {boolean} useCompatibilityMode - Whether to return the old format for backward compatibility
   * @returns {Array<PlayerWithStats> | Array<[Player, number]>} The standings, sorted by score and tie breaks
   */
  getStandings(useCompatibilityMode: boolean = false): Array<PlayerWithStats> | Array<[Player, number]> {
    const players = this.getActivePlayers();
    const playersWithStats: PlayerWithStats[] = [];

    // Create a map of players for the tie-break system
    const playersMap = new Map<string, Player>();
    for (const player of players) {
      playersMap.set(player.id, player);
    }

    // Create the tie-break system with the option to count byes as draws
    const tieBreakSystem = new SwissTieBreakSystem(
      playersMap,
      this.getAllPairings(),
      true // Count byes as draws instead of wins
    );

    // Calculate tie break scores for each player
    for (const player of players) {
      const tiebreaks = tieBreakSystem.calculateTieBreaks(player);
      const performanceRating = this.calculatePerformanceRating(player);
      const averageOpponentRating = this.calculateAverageOpponentRating(player);

      playersWithStats.push({
        ...player.toJSON(),
        performanceRating,
        averageOpponentRating,
        tiebreaks
      });
    }

    // Sort by score and tie breaks
    playersWithStats.sort((a, b) => {
      // First sort by score
      if (a.score !== b.score) {
        return b.score - a.score;
      }

      // Then by tie breaks in configured order
      for (const system of this.config.tieBreaks?.systems || []) {
        const comparison = tieBreakSystem.compareTieBreak(a, b, system);
        if (comparison !== 0) {
          return comparison;
        }
      }

      // If all tie breaks are equal, sort by rating
      return b.rating - a.rating;
    });

    // For backward compatibility with existing tests
    if (useCompatibilityMode) {
      return this.convertToOldFormat(playersWithStats);
    }

    return playersWithStats;
  }

  /**
   * Convert the new standings format to the old format for backward compatibility
   * @param {Array<PlayerWithStats>} standings - The standings in the new format
   * @returns {Array<[Player, number]>} The standings in the old format
   */
  private convertToOldFormat(standings: Array<PlayerWithStats>): Array<[Player, number]> {
    return standings.map(playerWithStats => {
      const player = this.players.get(playerWithStats.id);
      if (!player) {
        throw new Error(`Player with ID ${playerWithStats.id} not found`);
      }
      return [player, playerWithStats.score];
    });
  }

  /**
   * Compare two players based on a specific tie break system
   * @param {PlayerWithStats} a - The first player
   * @param {PlayerWithStats} b - The second player
   * @param {TieBreakSystem} system - The tie break system to use
   * @returns {number} Negative if a is better, positive if b is better, 0 if equal
   */
  private compareTieBreak(a: PlayerWithStats, b: PlayerWithStats, system: TieBreakSystem): number {
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
   * Calculate tie break scores for a player
   * @param {Player} player - The player
   * @returns {object} The tie break scores
   */
  private calculateTieBreaks(player: Player): PlayerWithStats['tiebreaks'] {
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
   * Calculate Buchholz score (sum of opponent scores)
   * @param {Player} player - The player
   * @returns {number} The Buchholz score
   */
  private calculateBuchholz(player: Player): number {
    let buchholz = 0;

    // Sum up the scores of all opponents
    for (const opponentId of player.previousOpponents) {
      const opponent = this.players.get(opponentId);
      if (opponent) {
        buchholz += opponent.score;
      }
    }

    return buchholz;
  }

  /**
   * Calculate Median Buchholz score (sum of opponent scores excluding best and worst)
   * @param {Player} player - The player
   * @returns {number} The Median Buchholz score
   */
  private calculateMedianBuchholz(player: Player): number {
    const opponentScores: number[] = [];

    // Get scores of all opponents
    for (const opponentId of player.previousOpponents) {
      const opponent = this.players.get(opponentId);
      if (opponent) {
        opponentScores.push(opponent.score);
      }
    }

    // If player has 0 or 1 opponents, return regular Buchholz
    if (opponentScores.length <= 1) {
      return this.calculateBuchholz(player);
    }

    // Sort scores
    opponentScores.sort((a, b) => a - b);

    // Remove best and worst scores
    opponentScores.shift(); // Remove lowest
    opponentScores.pop();   // Remove highest

    // Sum remaining scores
    return opponentScores.reduce((sum, score) => sum + score, 0);
  }

  /**
   * Calculate Progressive score (sum of progressive scores)
   * @param {Player} player - The player
   * @returns {number} The Progressive score
   */
  private calculateProgressive(player: Player): number {
    let progressive = 0;
    let roundScore = 0;

    // Get all pairings involving this player, sorted by round
    const playerPairings = this.getAllPairings()
      .filter(pairing =>
        pairing.whiteId === player.id ||
        pairing.blackId === player.id ||
        (pairing.whiteId === pairing.blackId && pairing.whiteId === player.id) // Bye
      )
      .sort((a, b) => (a.round || 0) - (b.round || 0));

    // Calculate progressive score
    for (const pairing of playerPairings) {
      if (pairing.result === Result.ONGOING) {
        continue;
      }

      let pointsEarned = 0;

      if (pairing.result === Result.BYE) {
        pointsEarned = this.config.scoring.drawPoints;
      } else if (pairing.whiteId === player.id) {
        if (pairing.result === Result.WHITE_WIN) {
          pointsEarned = this.config.scoring.winPoints;
        } else if (pairing.result === Result.BLACK_WIN) {
          pointsEarned = this.config.scoring.lossPoints;
        } else if (pairing.result === Result.DRAW) {
          pointsEarned = this.config.scoring.drawPoints;
        }
      } else if (pairing.blackId === player.id) {
        if (pairing.result === Result.BLACK_WIN) {
          pointsEarned = this.config.scoring.winPoints;
        } else if (pairing.result === Result.WHITE_WIN) {
          pointsEarned = this.config.scoring.lossPoints;
        } else if (pairing.result === Result.DRAW) {
          pointsEarned = this.config.scoring.drawPoints;
        }
      }

      roundScore += pointsEarned;
      progressive += roundScore;
    }

    return progressive;
  }

  /**
   * Calculate Direct Encounter score (head-to-head results against tied players)
   * @param {Player} player - The player
   * @returns {number} The Direct Encounter score
   */
  private calculateDirectEncounter(player: Player): number {
    // This is a placeholder value that will be calculated during the sorting process
    // when we know which players are tied
    return 0;
  }

  /**
   * Calculate number of wins
   * @param {Player} player - The player
   * @returns {number} The number of wins
   */
  private calculateWins(player: Player): number {
    let wins = 0;

    // Count wins in all pairings
    for (const pairing of this.getAllPairings()) {
      if (pairing.result === Result.ONGOING) {
        continue;
      }

      if (pairing.result === Result.BYE && pairing.whiteId === player.id) {
        wins++;
      } else if (pairing.result === Result.WHITE_WIN && pairing.whiteId === player.id) {
        wins++;
      } else if (pairing.result === Result.BLACK_WIN && pairing.blackId === player.id) {
        wins++;
      }
    }

    return wins;
  }

  /**
   * Calculate Sonneborn-Berger score
   * @param {Player} player - The player
   * @returns {number} The Sonneborn-Berger score
   */
  private calculateSonnebornBerger(player: Player): number {
    let sonnebornBerger = 0;

    // Get all finished pairings involving this player
    const playerPairings = this.getAllPairings()
      .filter(pairing =>
        (pairing.whiteId === player.id || pairing.blackId === player.id) &&
        pairing.result !== Result.ONGOING
      );

    for (const pairing of playerPairings) {
      // Skip byes
      if (pairing.result === Result.BYE) {
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
   * Calculate performance rating
   * @param {Player} player - The player
   * @returns {number} The performance rating
   */
  private calculatePerformanceRating(player: Player): number {
    const opponentRatings: number[] = [];
    let score = 0;
    let totalGames = 0;

    // Get all finished pairings involving this player
    const playerPairings = this.getAllPairings()
      .filter(pairing =>
        (pairing.whiteId === player.id || pairing.blackId === player.id) &&
        pairing.result !== Result.ONGOING &&
        pairing.result !== Result.BYE
      );

    for (const pairing of playerPairings) {
      const opponentId = pairing.whiteId === player.id ? pairing.blackId : pairing.whiteId;
      const opponent = this.players.get(opponentId);

      if (!opponent) {
        continue;
      }

      opponentRatings.push(opponent.rating);
      totalGames++;

      // Calculate score
      if ((pairing.result === Result.WHITE_WIN && pairing.whiteId === player.id) ||
          (pairing.result === Result.BLACK_WIN && pairing.blackId === player.id)) {
        score += 1;
      } else if (pairing.result === Result.DRAW) {
        score += 0.5;
      }
    }

    // If no games played, return player's rating
    if (totalGames === 0) {
      return player.rating;
    }

    // Calculate average opponent rating
    const averageOpponentRating = opponentRatings.reduce((sum, rating) => sum + rating, 0) / totalGames;

    // Calculate performance rating using the formula: Rp = Ra + 400 * (S - E) / N
    // where Ra is average opponent rating, S is score, E is expected score, N is number of games
    // For simplicity, we'll use a simpler formula: Rp = Ra + 400 * (S/N - 0.5)
    const performanceRating = averageOpponentRating + 400 * (score / totalGames - 0.5);

    return Math.round(performanceRating);
  }

  /**
   * Calculate average opponent rating
   * @param {Player} player - The player
   * @returns {number} The average opponent rating
   */
  private calculateAverageOpponentRating(player: Player): number {
    const opponentRatings: number[] = [];

    // Get all finished pairings involving this player
    const playerPairings = this.getAllPairings()
      .filter(pairing =>
        (pairing.whiteId === player.id || pairing.blackId === player.id) &&
        pairing.result !== Result.ONGOING &&
        pairing.result !== Result.BYE
      );

    for (const pairing of playerPairings) {
      const opponentId = pairing.whiteId === player.id ? pairing.blackId : pairing.whiteId;
      const opponent = this.players.get(opponentId);

      if (!opponent) {
        continue;
      }

      opponentRatings.push(opponent.rating);
    }

    // If no opponents, return player's rating
    if (opponentRatings.length === 0) {
      return player.rating;
    }

    // Calculate average opponent rating
    return Math.round(opponentRatings.reduce((sum, rating) => sum + rating, 0) / opponentRatings.length);
  }

  /**
   * Get the current round number
   * @returns {number} The current round number
   */
  getCurrentRound(): number {
    return this.currentRound;
  }

  /**
   * Check if all games in the current round are finished
   * @returns {boolean} Whether all games are finished
   */
  isRoundComplete(): boolean {
    return this.activePairings.length === 0;
  }

  /**
   * Get all active pairings
   * @returns {Pairing[]} The active pairings
   */
  getActivePairings(): Pairing[] {
    return [...this.activePairings];
  }

  /**
   * Get all finished pairings
   * @returns {Pairing[]} The finished pairings
   */
  getFinishedPairings(): Pairing[] {
    return [...this.finishedPairings];
  }

  /**
   * Get all pairings (active and finished)
   * @returns {Pairing[]} All pairings
   */
  getAllPairings(): Pairing[] {
    return [...this.activePairings, ...this.finishedPairings];
  }

  /**
   * Select a player to receive a bye
   * @param {Player[]} candidates - The players eligible for a bye
   * @returns {Player | undefined} The player who should receive a bye
   */
  private selectPlayerForBye(candidates: Player[]): Player | undefined {
    if (candidates.length === 0) {
      return undefined;
    }

    // Sort candidates by:
    // 1. Number of byes received (fewest first)
    // 2. Score (lowest first)
    // 3. Rating (lowest first)
    candidates.sort((a, b) => {
      // Players with fewer byes come first
      const aByeCount = this.playersWithByes.get(a.id) || 0;
      const bByeCount = this.playersWithByes.get(b.id) || 0;

      if (aByeCount !== bByeCount) {
        return aByeCount - bByeCount;
      }

      // Then sort by score (lowest first)
      if (a.score !== b.score) {
        return a.score - b.score;
      }

      // Then sort by rating (lowest first)
      return a.rating - b.rating;
    });

    return candidates[0];
  }

  /**
   * Create a "bye pairing" to track the bye in the tournament history
   * @param {string} playerId - The ID of the player who received a bye
   */
  private createByePairing(playerId: string): void {
    // Create a special pairing to represent the bye
    // We use the player's own ID for both white and black to indicate a bye
    const byePairing = new Pairing({
      tournamentId: this.tournamentId,
      whiteId: playerId,
      blackId: playerId, // Same ID indicates a bye
      round: this.currentRound,
      boardNumber: 0 // Board 0 indicates a bye
    });

    // Set the result to a bye
    byePairing.setResult(Result.BYE);

    // Add to finished pairings
    this.finishedPairings.push(byePairing);
  }

  /**
   * Get the player who received a bye in a specific round
   * @param {number} round - The round number
   * @returns {Player | undefined} The player who received a bye, or undefined if no bye was given
   */
  getByePlayerForRound(round: number): Player | undefined {
    const playerId = this.byeHistory.get(round);
    if (!playerId) {
      return undefined;
    }

    return this.players.get(playerId);
  }

  /**
   * Get the number of byes a player has received
   * @param {string} playerId - The ID of the player
   * @returns {number} The number of byes the player has received
   */
  getPlayerByeCount(playerId: string): number {
    return this.playersWithByes.get(playerId) || 0;
  }

  /**
   * Get all bye pairings
   * @returns {Pairing[]} All bye pairings
   */
  getByePairings(): Pairing[] {
    return this.finishedPairings.filter(pairing =>
      pairing.result === Result.BYE
    );
  }

  /**
   * Reset the pairing system
   */
  reset(): void {
    this.players.clear();
    this.activePairings = [];
    this.finishedPairings = [];
    this.currentRound = 0;
    this.playersWithByes.clear();
    this.byeHistory.clear();
  }
}
