import { TournamentConfig } from '../types/tournament';
import { Player } from '../models/Player';
import { Pairing } from '../models/Pairing';
import { Result } from '../types/pairing';
import { PlayerWithStats } from '../types/player';

/**
 * Represents a potential pairing between two players with a score
 */
interface PotentialPairing {
  whiteId: string;
  blackId: string;
  score: number;
}

/**
 * Core pairing system for arena tournaments
 */
export class PairingSystem {
  private players: Map<string, Player> = new Map();
  private waitingPlayers: Set<string> = new Set();
  private activePairings: Pairing[] = [];
  private finishedPairings: Pairing[] = [];
  private config: TournamentConfig;
  private tournamentId: string;

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
    if (!this.players.has(playerId)) {
      return false;
    }

    // Remove from waiting players
    this.waitingPlayers.delete(playerId);

    // Remove from players
    this.players.delete(playerId);

    return true;
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
   * Start a player waiting for a game
   * @param {string} playerId - The ID of the player to start waiting
   * @returns {boolean} Whether the player started waiting
   */
  startWaiting(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player) {
      return false;
    }

    if (player.startWaiting()) {
      this.waitingPlayers.add(playerId);
      return true;
    }

    return false;
  }

  /**
   * Stop a player waiting for a game
   * @param {string} playerId - The ID of the player to stop waiting
   * @returns {boolean} Whether the player stopped waiting
   */
  stopWaiting(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player || !player.isWaiting) {
      return false;
    }

    player.stopWaiting();
    this.waitingPlayers.delete(playerId);
    return true;
  }

  /**
   * Get all players
   * @returns {Player[]} All players
   */
  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  /**
   * Get all active players
   * @returns {Player[]} All active players
   */
  getActivePlayers(): Player[] {
    return Array.from(this.players.values());
  }

  /**
   * Get all waiting players
   * @returns {Player[]} All waiting players
   */
  getWaitingPlayers(): Player[] {
    return Array.from(this.waitingPlayers).map(id => this.players.get(id)!).filter(Boolean);
  }

  /**
   * Get all active pairings
   * @returns {Pairing[]} All active pairings
   */
  getActivePairings(): Pairing[] {
    return [...this.activePairings];
  }

  /**
   * Get all finished pairings
   * @returns {Pairing[]} All finished pairings
   */
  getFinishedPairings(): Pairing[] {
    return [...this.finishedPairings];
  }

  /**
   * Run a pairing cycle to create new pairings
   * @returns {Pairing[]} The new pairings created
   */
  runPairingCycle(): Pairing[] {
    // Get waiting players
    const waitingPlayers = this.getWaitingPlayers();
    if (waitingPlayers.length < 2) {
      return [];
    }

    // Create potential pairings
    const potentialPairings = this.generatePotentialPairings(waitingPlayers);

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
        blackId: potential.blackId
      });

      // Add to active pairings
      this.activePairings.push(pairing);
      newPairings.push(pairing);

      // Mark players as paired
      pairedPlayers.add(potential.whiteId);
      pairedPlayers.add(potential.blackId);

      // Update player state
      const whitePlayer = this.players.get(potential.whiteId)!;
      const blackPlayer = this.players.get(potential.blackId)!;

      whitePlayer.stopWaiting();
      blackPlayer.stopWaiting();

      this.waitingPlayers.delete(potential.whiteId);
      this.waitingPlayers.delete(potential.blackId);

      whitePlayer.incrementWhiteCount();
      blackPlayer.incrementBlackCount();
    }

    return newPairings;
  }

  /**
   * Generate potential pairings between waiting players
   * @param {Player[]} waitingPlayers - The waiting players
   * @returns {PotentialPairing[]} The potential pairings
   */
  private generatePotentialPairings(waitingPlayers: Player[]): PotentialPairing[] {
    const potentialPairings: PotentialPairing[] = [];

    // Generate all possible pairings
    for (let i = 0; i < waitingPlayers.length; i++) {
      const player1 = waitingPlayers[i];

      for (let j = i + 1; j < waitingPlayers.length; j++) {
        const player2 = waitingPlayers[j];

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

    return potentialPairings;
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

    // Bonus for waiting time
    const waitingTime1 = player1.getWaitingTimeSeconds();
    const waitingTime2 = player2.getWaitingTimeSeconds();
    score += (waitingTime1 + waitingTime2) * this.config.pairing.waitingTimeWeight;

    // Bonus for similar scores
    const scoreDiff = Math.abs(player1.score - player2.score);
    score -= scoreDiff * 10;

    return score;
  }

  /**
   * Finish a game with a result
   * @param {number} pairingIndex - The index of the pairing in the active pairings array
   * @param {Result} result - The result of the game
   * @returns {boolean} Whether the game was finished
   */
  finishGame(pairingIndex: number, result: Result): boolean {
    if (pairingIndex < 0 || pairingIndex >= this.activePairings.length) {
      return false;
    }

    const pairing = this.activePairings[pairingIndex];
    if (pairing.isFinished()) {
      return false;
    }

    // Update pairing
    pairing.finishGame(result);

    // Update players
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
    const index = this.activePairings.indexOf(pairing);
    if (index > -1) {
      this.activePairings.splice(index, 1);
    }
    this.finishedPairings.push(pairing);

    return true;
  }

  /**
   * Get the standings for the tournament
   * @param {boolean} useCompatibilityMode - Whether to return the old format for backward compatibility
   * @returns {Array<[Player, number]> | Array<PlayerWithStats>} The standings, sorted by score
   */
  getStandings(useCompatibilityMode: boolean = true): Array<[Player, number]> | Array<PlayerWithStats> {
    const players = this.getActivePlayers();
    const standings: Array<[Player, number]> = players.map(player => [player, player.score]);

    // Sort by score (descending)
    standings.sort((a, b) => b[1] - a[1]);

    return standings;
  }

  /**
   * Reset the pairing system
   */
  reset(): void {
    this.players.clear();
    this.waitingPlayers.clear();
    this.activePairings = [];
    this.finishedPairings = [];
  }
}
