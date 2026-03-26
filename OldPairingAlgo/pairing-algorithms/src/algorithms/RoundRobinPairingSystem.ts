import { TournamentConfig } from '../types/tournament';
import { Player } from '../models/Player';
import { Pairing } from '../models/Pairing';
import { Result } from '../types/pairing';
import { PlayerWithStats } from '../types/player';

/**
 * Round Robin pairing system for tournaments where each player plays against every other player
 * In Round Robin tournaments, each player plays exactly one game against every other player
 */
export class RoundRobinPairingSystem {
  private players: Map<string, Player> = new Map();
  private activePairings: Pairing[] = [];
  private finishedPairings: Pairing[] = [];
  private config: TournamentConfig;
  private tournamentId: string;
  private currentRound: number = 0;
  private totalRounds: number = 0;
  private roundPairings: Map<number, string[][]> = new Map(); // Maps round number to array of player ID pairs
  private initialized: boolean = false;

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

    // Can't add players after tournament has started
    if (this.currentRound > 0) {
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
    // Can't remove players after tournament has started
    if (this.currentRound > 0) {
      return false;
    }

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
    return Array.from(this.players.values()).filter(player => player.isActive);
  }

  /**
   * Get all waiting players
   * @returns {Player[]} All waiting players
   */
  getWaitingPlayers(): Player[] {
    return Array.from(this.players.values()).filter(player => player.isWaiting);
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
   * Get the current round
   * @returns {number} The current round
   */
  getCurrentRound(): number {
    return this.currentRound;
  }

  /**
   * Get the total number of rounds
   * @returns {number} The total number of rounds
   */
  getTotalRounds(): number {
    return this.totalRounds;
  }

  /**
   * Initialize the round robin schedule
   * @param {boolean} force - Whether to force re-initialization
   * @returns {boolean} Whether the schedule was initialized successfully
   */
  initializeSchedule(force: boolean = false): boolean {
    // If already initialized and not forcing, return
    if (this.initialized && !force) {
      return false;
    }

    const activePlayers = this.getActivePlayers();

    if (activePlayers.length < 2) {
      return false;
    }

    // Calculate total rounds needed
    // For odd number of players, we add a dummy player, so total rounds is equal to player count
    const playerCount = activePlayers.length;
    const isDoubleRoundRobin = this.config.roundRobin?.isDoubleRoundRobin || false;

    // For double round-robin, each player plays every other player twice
    const baseRounds = playerCount % 2 === 0 ? playerCount - 1 : playerCount;
    this.totalRounds = isDoubleRoundRobin ? baseRounds * 2 : baseRounds;

    // Generate round robin schedule
    this.generateRoundRobinSchedule(activePlayers.map(player => player.id), isDoubleRoundRobin);

    // Mark as initialized
    this.initialized = true;

    return true;
  }

  /**
   * Generate a round robin schedule using the Circle Method (Berger tables)
   * This is a standard algorithm for round robin tournaments that ensures:
   * - Each player plays exactly once against every other player (or twice for double round-robin)
   * - The distribution of games is balanced across rounds
   * - Proper handling of odd numbers of players with byes
   *
   * @param {string[]} playerIds - The IDs of the players
   * @param {boolean} isDoubleRoundRobin - Whether to generate a double round-robin schedule
   */
  private generateRoundRobinSchedule(playerIds: string[], isDoubleRoundRobin: boolean = false): void {
    // Make a copy of the player IDs
    let players = [...playerIds];

    // If odd number of players, add a "dummy" player to represent a bye
    const hasDummy = players.length % 2 === 1;
    if (hasDummy) {
      players.push('BYE');
    }

    const n = players.length;
    const baseRounds = n - 1;
    const matchesPerRound = n / 2;

    // Generate the first round-robin cycle
    for (let round = 1; round <= baseRounds; round++) {
      const roundPairings: string[][] = [];

      // Create a rotated array of players for this round
      // First player stays fixed, others rotate
      const rotatedPlayers = this.getRotatedPlayers(players, round - 1);

      // Create pairings for this round
      for (let i = 0; i < matchesPerRound; i++) {
        const player1 = rotatedPlayers[i];
        const player2 = rotatedPlayers[n - 1 - i];

        // Skip if either player is the dummy "BYE" player
        if (player1 === 'BYE' || player2 === 'BYE') {
          continue;
        }

        // Add pairing to this round
        roundPairings.push([player1, player2]);
      }

      // Store pairings for this round
      this.roundPairings.set(round, roundPairings);
    }

    // If double round-robin, generate the second cycle with colors reversed
    if (isDoubleRoundRobin) {
      for (let round = 1; round <= baseRounds; round++) {
        const firstCyclePairings = this.roundPairings.get(round) || [];
        const secondCycleRound = round + baseRounds;
        const reversedPairings: string[][] = [];

        // Reverse the colors for the second cycle
        for (const [player1, player2] of firstCyclePairings) {
          reversedPairings.push([player2, player1]); // Swap colors
        }

        // Store the reversed pairings for the second cycle
        this.roundPairings.set(secondCycleRound, reversedPairings);
      }
    }
  }

  /**
   * Get a rotated array of players for a specific rotation
   * Used in the Circle Method for round robin scheduling
   *
   * @param {string[]} players - The array of player IDs
   * @param {number} rotation - The number of positions to rotate
   * @returns {string[]} The rotated array of player IDs
   */
  private getRotatedPlayers(players: string[], rotation: number): string[] {
    const n = players.length;
    const result = new Array(n);

    // First player stays fixed at position 0
    result[0] = players[0];

    // Rotate the rest of the players clockwise
    for (let i = 1; i < n; i++) {
      // Calculate the source position after rotation
      const sourcePos = ((i - 1 - rotation) % (n - 1) + (n - 1)) % (n - 1) + 1;
      result[i] = players[sourcePos];
    }

    return result;
  }

  /**
   * Start a new round of pairings
   * @returns {Pairing[]} The created pairings
   */
  startNewRound(): Pairing[] {
    // Increment round number
    this.currentRound++;

    // Check if we've exceeded the total rounds
    if (this.currentRound > this.totalRounds) {
      return [];
    }

    // Get pairings for this round
    let roundPairings = this.roundPairings.get(this.currentRound) || [];

    // Create pairings
    const newPairings: Pairing[] = [];

    // Check for players with byes in this round
    const activePlayers = this.getActivePlayers();
    const pairedPlayers = new Set<string>();

    // Add all players who are paired in this round to the set
    for (const [player1Id, player2Id] of roundPairings) {
      pairedPlayers.add(player1Id);
      pairedPlayers.add(player2Id);
    }

    // Find players who have a bye in this round
    for (const player of activePlayers) {
      if (!pairedPlayers.has(player.id)) {
        // This player has a bye in this round
        this.handlePlayerBye(player);
      }
    }

    // If no pairings were found for this round but we haven't exceeded total rounds,
    // this might be due to a bug in the schedule generation. Let's regenerate the schedule.
    if (roundPairings.length === 0 && this.currentRound <= this.totalRounds) {
      console.log(`No pairings found for round ${this.currentRound}. Regenerating schedule.`);

      // Reset to allow regeneration
      this.initialized = false;
      this.roundPairings.clear();

      // Regenerate the schedule
      this.initializeSchedule(true);

      // Try again with the regenerated schedule
      roundPairings = this.roundPairings.get(this.currentRound) || [];
      if (roundPairings.length > 0) {
        console.log(`Successfully regenerated schedule for round ${this.currentRound}.`);
      }
    }

    // Create pairings for players who are playing
    for (let i = 0; i < roundPairings.length; i++) {
      const [player1Id, player2Id] = roundPairings[i];

      // Get players
      const player1 = this.players.get(player1Id);
      const player2 = this.players.get(player2Id);

      if (!player1 || !player2) {
        continue;
      }

      // Determine colors based on color balance
      let whiteId: string;
      let blackId: string;

      // Check color balance
      const player1WhiteCount = player1.whiteCount;
      const player2WhiteCount = player2.whiteCount;

      // Player with fewer white games gets white
      if (player1WhiteCount < player2WhiteCount) {
        whiteId = player1Id;
        blackId = player2Id;
      } else if (player2WhiteCount < player1WhiteCount) {
        whiteId = player2Id;
        blackId = player1Id;
      } else {
        // If equal white count, alternate based on round and board number
        if ((this.currentRound + i) % 2 === 0) {
          whiteId = player1Id;
          blackId = player2Id;
        } else {
          whiteId = player2Id;
          blackId = player1Id;
        }
      }

      // Create the pairing
      const pairing = new Pairing({
        tournamentId: this.tournamentId,
        whiteId,
        blackId,
        round: this.currentRound,
        boardNumber: i + 1
      });

      // Add to pairings
      newPairings.push(pairing);
      this.activePairings.push(pairing);

      // Update color counts
      const whitePlayer = this.players.get(whiteId);
      const blackPlayer = this.players.get(blackId);

      if (whitePlayer) {
        whitePlayer.incrementWhiteCount();
      }

      if (blackPlayer) {
        blackPlayer.incrementBlackCount();
      }

      // Add opponents to history
      if (whitePlayer && blackPlayer) {
        whitePlayer.addOpponent(blackPlayer.id);
        blackPlayer.addOpponent(whitePlayer.id);
      }
    }

    return newPairings;
  }

  /**
   * Handle a player who has a bye in the current round
   * @param {Player} player - The player who has a bye
   */
  private handlePlayerBye(player: Player): void {
    // Award a bye (counts as a draw)
    player.addScore(this.config.scoring.drawPoints);

    // Create a special pairing to represent the bye
    const byePairing = new Pairing({
      tournamentId: this.tournamentId,
      whiteId: player.id,
      blackId: player.id, // Same ID indicates a bye
      round: this.currentRound,
      boardNumber: 0 // Board 0 indicates a bye
    });

    // Set the result to a bye
    byePairing.setResult(Result.BYE);

    // Add to finished pairings
    this.finishedPairings.push(byePairing);
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

    // Get the pairing
    const pairing = this.activePairings[pairingIndex];

    // Set the result
    pairing.setResult(result);

    // Get the players
    const whitePlayer = this.players.get(pairing.whiteId);
    const blackPlayer = this.players.get(pairing.blackId);

    if (whitePlayer && blackPlayer) {
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

    // Move pairing from active to finished
    this.activePairings.splice(pairingIndex, 1);
    this.finishedPairings.push(pairing);

    return true;
  }

  /**
   * Check if the current round is complete
   * @returns {boolean} Whether the current round is complete
   */
  isRoundComplete(): boolean {
    // If there are no active pairings, the round is complete
    // But only if we've started at least one round
    return this.currentRound > 0 && this.activePairings.length === 0;
  }

  /**
   * Get the standings for the tournament with tiebreaks
   * @param {boolean} useCompatibilityMode - Whether to return the old format for backward compatibility
   * @returns {Array<[Player, number]> | Array<PlayerWithStats>} The standings, sorted by score and tiebreaks
   */
  getStandings(useCompatibilityMode: boolean = true): Array<[Player, number]> | Array<PlayerWithStats> {
    const players = this.getActivePlayers();

    // Calculate tiebreaks for all players
    this.calculateTiebreaks(players);

    if (useCompatibilityMode) {
      const standings: Array<[Player, number]> = players.map(player => [player, player.score]);

      // Sort by score (descending)
      standings.sort((a, b) => {
        // First sort by score
        if (b[0].score !== a[0].score) {
          return b[0].score - a[0].score;
        }

        // Then by direct encounter (head-to-head)
        const directEncounterTiebreak = this.getDirectEncounterTiebreak(a[0], b[0]);
        if (directEncounterTiebreak !== 0) {
          return directEncounterTiebreak;
        }

        // Then by Sonneborn-Berger score
        const aSB = a[0].getTiebreak('sonneborn-berger') || 0;
        const bSB = b[0].getTiebreak('sonneborn-berger') || 0;
        if (aSB !== bSB) {
          return bSB - aSB;
        }

        // Then by number of wins
        const aWins = a[0].getTiebreak('wins') || 0;
        const bWins = b[0].getTiebreak('wins') || 0;
        if (aWins !== bWins) {
          return bWins - aWins;
        }

        // Finally by rating
        return b[0].rating - a[0].rating;
      });

      return standings;
    } else {
      // Return detailed player stats
      const standings: Array<PlayerWithStats> = players.map(player => {
        const playerStats: PlayerWithStats = {
          id: player.id,
          name: player.name,
          rating: player.rating,
          score: player.score,
          gamesPlayed: player.gamesPlayed,
          isActive: player.isActive,
          isWaiting: player.isWaiting,
          waitingSince: player.waitingSince,
          whiteCount: player.whiteCount,
          blackCount: player.blackCount,
          currentStreak: player.currentStreak,
          previousOpponents: [...player.previousOpponents],
          tiebreaks: {
            'direct-encounter': player.getTiebreak('direct-encounter') || 0,
            'sonneborn-berger': player.getTiebreak('sonneborn-berger') || 0,
            'wins': player.getTiebreak('wins') || 0,
            'draws': player.getTiebreak('draws') || 0,
            'losses': player.getTiebreak('losses') || 0
          }
        };

        if (player.team) {
          playerStats.team = player.team;
        }

        return playerStats;
      });

      // Sort by score and tiebreaks
      standings.sort((a, b) => {
        // First sort by score
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        // Then by direct encounter (head-to-head)
        const aDirectEncounter = a.tiebreaks['direct-encounter'] || 0;
        const bDirectEncounter = b.tiebreaks['direct-encounter'] || 0;
        if (bDirectEncounter !== aDirectEncounter) {
          return bDirectEncounter - aDirectEncounter;
        }

        // Then by Sonneborn-Berger score
        const aSB = a.tiebreaks['sonneborn-berger'] || 0;
        const bSB = b.tiebreaks['sonneborn-berger'] || 0;
        if (bSB !== aSB) {
          return bSB - aSB;
        }

        // Then by number of wins
        const aWins = a.tiebreaks['wins'] || 0;
        const bWins = b.tiebreaks['wins'] || 0;
        if (bWins !== aWins) {
          return bWins - aWins;
        }

        // Finally by rating
        return b.rating - a.rating;
      });

      return standings;
    }
  }

  /**
   * Calculate tiebreaks for all players
   * @param {Player[]} players - The players to calculate tiebreaks for
   */
  private calculateTiebreaks(players: Player[]): void {
    // Reset tiebreaks
    for (const player of players) {
      player.clearTiebreaks();
    }

    // Calculate wins, draws, losses
    this.calculateBasicStats(players);

    // Calculate Sonneborn-Berger score
    this.calculateSonnebornBerger(players);

    // Calculate direct encounter scores
    this.calculateDirectEncounters(players);
  }

  /**
   * Calculate basic stats (wins, draws, losses) for all players
   * @param {Player[]} players - The players to calculate stats for
   */
  private calculateBasicStats(players: Player[]): void {
    // Create a map of player IDs to players for quick lookup
    const playerMap = new Map<string, Player>();
    for (const player of players) {
      playerMap.set(player.id, player);
    }

    // Count wins, draws, losses for each player
    for (const pairing of this.finishedPairings) {
      // Skip byes
      if (pairing.whiteId === pairing.blackId) {
        continue;
      }

      const whitePlayer = playerMap.get(pairing.whiteId);
      const blackPlayer = playerMap.get(pairing.blackId);

      if (!whitePlayer || !blackPlayer) {
        continue;
      }

      if (pairing.result === Result.WHITE_WIN) {
        whitePlayer.incrementTiebreak('wins');
        blackPlayer.incrementTiebreak('losses');
      } else if (pairing.result === Result.BLACK_WIN) {
        whitePlayer.incrementTiebreak('losses');
        blackPlayer.incrementTiebreak('wins');
      } else if (pairing.result === Result.DRAW) {
        whitePlayer.incrementTiebreak('draws');
        blackPlayer.incrementTiebreak('draws');
      }
    }
  }

  /**
   * Calculate Sonneborn-Berger scores for all players
   * The Sonneborn-Berger score is the sum of the scores of the opponents a player has defeated,
   * plus half the scores of the opponents with whom the player has drawn.
   *
   * @param {Player[]} players - The players to calculate Sonneborn-Berger scores for
   */
  private calculateSonnebornBerger(players: Player[]): void {
    // Create a map of player IDs to players for quick lookup
    const playerMap = new Map<string, Player>();
    for (const player of players) {
      playerMap.set(player.id, player);
    }

    // Calculate Sonneborn-Berger score for each player
    for (const player of players) {
      let sbScore = 0;

      for (const pairing of this.finishedPairings) {
        // Skip byes
        if (pairing.whiteId === pairing.blackId) {
          continue;
        }

        // If player was white
        if (pairing.whiteId === player.id) {
          const opponent = playerMap.get(pairing.blackId);
          if (!opponent) continue;

          if (pairing.result === Result.WHITE_WIN) {
            // Add opponent's score for a win
            sbScore += opponent.score;
          } else if (pairing.result === Result.DRAW) {
            // Add half of opponent's score for a draw
            sbScore += opponent.score / 2;
          }
        }
        // If player was black
        else if (pairing.blackId === player.id) {
          const opponent = playerMap.get(pairing.whiteId);
          if (!opponent) continue;

          if (pairing.result === Result.BLACK_WIN) {
            // Add opponent's score for a win
            sbScore += opponent.score;
          } else if (pairing.result === Result.DRAW) {
            // Add half of opponent's score for a draw
            sbScore += opponent.score / 2;
          }
        }
      }

      player.setTiebreak('sonneborn-berger', sbScore);
    }
  }

  /**
   * Calculate direct encounter scores for all players
   * @param {Player[]} players - The players to calculate direct encounter scores for
   */
  private calculateDirectEncounters(players: Player[]): void {
    // Create a map to store direct encounter results
    const directEncounters = new Map<string, Map<string, number>>();

    // Initialize the map for each player
    for (const player of players) {
      directEncounters.set(player.id, new Map<string, number>());
    }

    // Record direct encounter results
    for (const pairing of this.finishedPairings) {
      // Skip byes
      if (pairing.whiteId === pairing.blackId) {
        continue;
      }

      const whiteMap = directEncounters.get(pairing.whiteId);
      const blackMap = directEncounters.get(pairing.blackId);

      if (!whiteMap || !blackMap) {
        continue;
      }

      if (pairing.result === Result.WHITE_WIN) {
        whiteMap.set(pairing.blackId, (whiteMap.get(pairing.blackId) || 0) + 1);
      } else if (pairing.result === Result.BLACK_WIN) {
        blackMap.set(pairing.whiteId, (blackMap.get(pairing.whiteId) || 0) + 1);
      } else if (pairing.result === Result.DRAW) {
        whiteMap.set(pairing.blackId, (whiteMap.get(pairing.blackId) || 0) + 0.5);
        blackMap.set(pairing.whiteId, (blackMap.get(pairing.whiteId) || 0) + 0.5);
      }
    }

    // Store direct encounter score for each player
    for (const player of players) {
      const encounters = directEncounters.get(player.id);
      if (!encounters) continue;

      let totalScore = 0;
      for (const score of encounters.values()) {
        totalScore += score;
      }

      player.setTiebreak('direct-encounter', totalScore);
    }
  }

  /**
   * Get the direct encounter tiebreak between two players
   * @param {Player} player1 - The first player
   * @param {Player} player2 - The second player
   * @returns {number} Positive if player1 won, negative if player2 won, 0 if tied or no encounter
   */
  private getDirectEncounterTiebreak(player1: Player, player2: Player): number {
    let player1Score = 0;
    let player2Score = 0;

    for (const pairing of this.finishedPairings) {
      // Check if this pairing involves both players
      if ((pairing.whiteId === player1.id && pairing.blackId === player2.id) ||
          (pairing.whiteId === player2.id && pairing.blackId === player1.id)) {

        if (pairing.whiteId === player1.id) {
          if (pairing.result === Result.WHITE_WIN) {
            player1Score += 1;
          } else if (pairing.result === Result.BLACK_WIN) {
            player2Score += 1;
          } else if (pairing.result === Result.DRAW) {
            player1Score += 0.5;
            player2Score += 0.5;
          }
        } else { // player2 is white
          if (pairing.result === Result.WHITE_WIN) {
            player2Score += 1;
          } else if (pairing.result === Result.BLACK_WIN) {
            player1Score += 1;
          } else if (pairing.result === Result.DRAW) {
            player1Score += 0.5;
            player2Score += 0.5;
          }
        }
      }
    }

    return player1Score - player2Score;
  }
}
