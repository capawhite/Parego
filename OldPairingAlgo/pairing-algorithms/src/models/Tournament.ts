import { Tournament as TournamentType, TournamentConfig, TournamentStatus, TournamentType as TournamentTypeEnum } from '../types/tournament';
import { v4 as uuidv4 } from 'uuid';
import { PairingSystem } from '../algorithms/PairingSystem';
import { SwissPairingSystem } from '../algorithms/SwissPairingSystem';
import { EliminationPairingSystem } from '../algorithms/EliminationPairingSystem';
import { RoundRobinPairingSystem } from '../algorithms/RoundRobinPairingSystem';
import { Player } from './Player';
import { Pairing } from './Pairing';
import { Result } from '../types/pairing';
import { PlayerWithStats } from '../types/player';

/**
 * Tournament class for managing a tournament
 */
export class Tournament implements Omit<TournamentType, 'id'> {
  id: string;
  name: string;
  description?: string;
  type: TournamentTypeEnum;
  status: TournamentStatus;
  config: TournamentConfig;
  createdAt: number;
  startTime?: number;
  endTime?: number;
  durationMinutes?: number;
  rounds?: number;
  currentRound?: number;
  minRating?: number;
  maxRating?: number;
  isPrivate: boolean;
  password?: string;
  organizerId: string;

  private pairingSystem: PairingSystem | SwissPairingSystem | EliminationPairingSystem | RoundRobinPairingSystem;
  private pairingInterval?: NodeJS.Timeout;
  private isDoubleElimination: boolean = false;

  constructor(data: {
    name: string;
    type: TournamentTypeEnum;
    config: TournamentConfig;
    organizerId: string;
    description?: string;
    durationMinutes?: number;
    rounds?: number;
    minRating?: number;
    maxRating?: number;
    isPrivate?: boolean;
    password?: string;
    id?: string;
    isDoubleElimination?: boolean;
  }) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.description = data.description;
    this.type = data.type;
    this.status = TournamentStatus.CREATED;
    this.config = data.config;
    this.createdAt = Date.now();
    this.durationMinutes = data.durationMinutes;
    this.rounds = data.rounds;
    this.minRating = data.minRating;
    this.maxRating = data.maxRating;
    this.isPrivate = data.isPrivate || false;
    this.password = data.password;
    this.organizerId = data.organizerId;

    // Set double elimination from config or parameter
    if (this.type === TournamentTypeEnum.ELIMINATION) {
      this.isDoubleElimination = data.isDoubleElimination ||
        (this.config.elimination?.isDoubleElimination || false);
    } else {
      this.isDoubleElimination = false;
    }

    // Initialize pairing system based on tournament type
    if (this.type === TournamentTypeEnum.SWISS) {
      this.pairingSystem = new SwissPairingSystem(this.id, this.config);
      this.currentRound = 0;
    } else if (this.type === TournamentTypeEnum.ELIMINATION) {
      this.pairingSystem = new EliminationPairingSystem(this.id, this.config, this.isDoubleElimination);
      this.currentRound = 0;
    } else if (this.type === TournamentTypeEnum.ROUND_ROBIN) {
      this.pairingSystem = new RoundRobinPairingSystem(this.id, this.config);
      this.currentRound = 0;
    } else {
      this.pairingSystem = new PairingSystem(this.id, this.config);
    }
  }

  /**
   * Validate player count requirements for the tournament type
   * @returns {string | null} Error message if validation fails, null if valid
   */
  private validatePlayerCount(): string | null {
    const playerCount = this.getAllPlayers().length;

    switch (this.type) {
      case TournamentTypeEnum.ELIMINATION:
        if (playerCount < 4) {
          return 'Elimination tournaments require at least 4 players';
        }
        if (playerCount % 2 !== 0) {
          return 'Elimination tournaments require an even number of players';
        }
        break;

      case TournamentTypeEnum.ROUND_ROBIN:
        if (playerCount < 2) {
          return 'Round Robin tournaments require at least 2 players';
        }
        // Note: Round Robin can handle odd numbers with byes, so no even requirement
        break;

      case TournamentTypeEnum.SWISS:
        if (playerCount < 2) {
          return 'Swiss tournaments require at least 2 players';
        }
        break;

      case TournamentTypeEnum.ARENA:
        if (playerCount < 2) {
          return 'Arena tournaments require at least 2 players';
        }
        break;

      default:
        return 'Unknown tournament type';
    }

    return null; // Valid
  }

  /**
   * Start the tournament
   * @returns {boolean} Whether the tournament was started
   */
  start(): boolean {
    if (this.status !== TournamentStatus.CREATED) {
      return false;
    }

    // Validate player count requirements
    const validationError = this.validatePlayerCount();
    if (validationError) {
      throw new Error(validationError);
    }

    this.status = TournamentStatus.RUNNING;
    this.startTime = Date.now();

    if (this.durationMinutes) {
      this.endTime = this.startTime + this.durationMinutes * 60 * 1000;
    }

    // Start pairing interval
    this.startPairingInterval();

    return true;
  }

  /**
   * Pause the tournament
   * @returns {boolean} Whether the tournament was paused
   */
  pause(): boolean {
    if (this.status !== TournamentStatus.RUNNING) {
      return false;
    }

    this.status = TournamentStatus.PAUSED;
    this.stopPairingInterval();

    return true;
  }

  /**
   * Resume the tournament
   * @returns {boolean} Whether the tournament was resumed
   */
  resume(): boolean {
    if (this.status !== TournamentStatus.PAUSED) {
      return false;
    }

    this.status = TournamentStatus.RUNNING;
    this.startPairingInterval();

    return true;
  }

  /**
   * End the tournament
   * @returns {boolean} Whether the tournament was ended
   */
  end(): boolean {
    if (this.status !== TournamentStatus.RUNNING && this.status !== TournamentStatus.PAUSED) {
      return false;
    }

    this.status = TournamentStatus.FINISHED;
    this.endTime = Date.now();
    this.stopPairingInterval();

    return true;
  }

  /**
   * Cancel the tournament
   * @returns {boolean} Whether the tournament was cancelled
   */
  cancel(): boolean {
    if (this.status === TournamentStatus.FINISHED || this.status === TournamentStatus.CANCELLED) {
      return false;
    }

    this.status = TournamentStatus.CANCELLED;
    this.endTime = Date.now();
    this.stopPairingInterval();

    return true;
  }

  /**
   * Add a player to the tournament
   * @param {Player} player - The player to add
   * @returns {boolean} Whether the player was added
   */
  addPlayer(player: Player): boolean {
    // Check if tournament is active
    if (this.status !== TournamentStatus.CREATED && this.status !== TournamentStatus.RUNNING) {
      return false;
    }

    // Check rating restrictions
    if (this.minRating !== undefined && player.rating < this.minRating) {
      return false;
    }

    if (this.maxRating !== undefined && player.rating > this.maxRating) {
      return false;
    }

    return this.pairingSystem.addPlayer(player);
  }

  /**
   * Remove a player from the tournament
   * @param {string} playerId - The ID of the player to remove
   * @returns {boolean} Whether the player was removed
   */
  removePlayer(playerId: string): boolean {
    // Elimination tournaments don't support removing players after brackets are created
    if (this.type === TournamentTypeEnum.ELIMINATION && this.currentRound && this.currentRound > 0) {
      return false;
    }

    if (this.type === TournamentTypeEnum.ELIMINATION) {
      const player = this.getPlayer(playerId);
      if (player) {
        player.isActive = false;
        return true;
      }
      return false;
    }

    return (this.pairingSystem as PairingSystem | SwissPairingSystem).removePlayer(playerId);
  }

  /**
   * Start a player waiting for a game
   * @param {string} playerId - The ID of the player to start waiting
   * @returns {boolean} Whether the player started waiting
   */
  startPlayerWaiting(playerId: string): boolean {
    if (this.status !== TournamentStatus.RUNNING) {
      return false;
    }

    // Swiss tournaments don't use waiting players
    if (this.type === TournamentTypeEnum.SWISS) {
      return false;
    }

    return (this.pairingSystem as PairingSystem).startWaiting(playerId);
  }

  /**
   * Stop a player waiting for a game
   * @param {string} playerId - The ID of the player to stop waiting
   * @returns {boolean} Whether the player stopped waiting
   */
  stopPlayerWaiting(playerId: string): boolean {
    // Swiss tournaments don't use waiting players
    if (this.type === TournamentTypeEnum.SWISS) {
      return false;
    }

    return (this.pairingSystem as PairingSystem).stopWaiting(playerId);
  }

  /**
   * Finish a game with a result
   * @param {number} pairingIndex - The index of the pairing in the active pairings array
   * @param {Result} result - The result of the game
   * @returns {boolean} Whether the game was finished
   */
  finishGame(pairingIndex: number, result: Result): boolean {
    return this.pairingSystem.finishGame(pairingIndex, result);
  }

  /**
   * Get a player by ID
   * @param {string} playerId - The ID of the player to get
   * @returns {Player | undefined} The player, or undefined if not found
   */
  getPlayer(playerId: string): Player | undefined {
    return this.pairingSystem.getPlayer(playerId);
  }

  /**
   * Get all players
   * @returns {Player[]} All players
   */
  getAllPlayers(): Player[] {
    if (this.type === TournamentTypeEnum.SWISS) {
      // For Swiss tournaments, get all players from the active players
      return (this.pairingSystem as SwissPairingSystem).getActivePlayers();
    } else if (this.type === TournamentTypeEnum.ELIMINATION) {
      return (this.pairingSystem as EliminationPairingSystem).getAllPlayers();
    } else if (this.type === TournamentTypeEnum.ROUND_ROBIN) {
      return (this.pairingSystem as RoundRobinPairingSystem).getAllPlayers();
    }

    return (this.pairingSystem as PairingSystem).getAllPlayers();
  }

  /**
   * Get all active players
   * @returns {Player[]} All active players
   */
  getActivePlayers(): Player[] {
    return this.pairingSystem.getActivePlayers();
  }

  /**
   * Get all waiting players
   * @returns {Player[]} All waiting players
   */
  getWaitingPlayers(): Player[] {
    // Swiss tournaments don't use waiting players
    if (this.type === TournamentTypeEnum.SWISS) {
      return [];
    }

    return (this.pairingSystem as PairingSystem).getWaitingPlayers();
  }

  /**
   * Get all active pairings
   * @returns {Pairing[]} All active pairings
   */
  getActivePairings(): Pairing[] {
    if (this.type === TournamentTypeEnum.SWISS) {
      return (this.pairingSystem as SwissPairingSystem).getActivePairings();
    } else if (this.type === TournamentTypeEnum.ELIMINATION) {
      return (this.pairingSystem as EliminationPairingSystem).getActivePairings();
    } else if (this.type === TournamentTypeEnum.ROUND_ROBIN) {
      return (this.pairingSystem as RoundRobinPairingSystem).getActivePairings();
    }

    return (this.pairingSystem as PairingSystem).getActivePairings();
  }

  /**
   * Get all finished pairings
   * @returns {Pairing[]} All finished pairings
   */
  getFinishedPairings(): Pairing[] {
    if (this.type === TournamentTypeEnum.SWISS) {
      return (this.pairingSystem as SwissPairingSystem).getFinishedPairings();
    } else if (this.type === TournamentTypeEnum.ELIMINATION) {
      return (this.pairingSystem as EliminationPairingSystem).getFinishedPairings();
    } else if (this.type === TournamentTypeEnum.ROUND_ROBIN) {
      return (this.pairingSystem as RoundRobinPairingSystem).getFinishedPairings();
    }

    return (this.pairingSystem as PairingSystem).getFinishedPairings();
  }

  /**
   * Get the standings for the tournament
   * @param {boolean} useCompatibilityMode - Whether to return the old format for backward compatibility
   * @returns {Array<PlayerWithStats> | Array<[Player, number]>} The standings, sorted by score and tie breaks
   */
  getStandings(useCompatibilityMode: boolean = true): Array<PlayerWithStats> | Array<[Player, number]> {
    if (this.type === TournamentTypeEnum.SWISS) {
      return (this.pairingSystem as SwissPairingSystem).getStandings(useCompatibilityMode);
    }
    return this.pairingSystem.getStandings();
  }

  /**
   * Get the pairing system
   * @returns {PairingSystem | SwissPairingSystem | EliminationPairingSystem | RoundRobinPairingSystem} The pairing system
   */
  getPairingSystem(): PairingSystem | SwissPairingSystem | EliminationPairingSystem | RoundRobinPairingSystem {
    return this.pairingSystem;
  }

  /**
   * Check if the tournament is finished
   * @returns {boolean} Whether the tournament is finished
   */
  isFinished(): boolean {
    return this.status === TournamentStatus.FINISHED || this.status === TournamentStatus.CANCELLED;
  }

  /**
   * Get the remaining time in seconds
   * @returns {number} The remaining time in seconds, or 0 if the tournament is finished
   */
  getRemainingTimeSeconds(): number {
    if (this.isFinished() || !this.endTime) {
      return 0;
    }

    const remainingMs = this.endTime - Date.now();
    return Math.max(0, Math.floor(remainingMs / 1000));
  }

  /**
   * Check if the tournament should end
   * @returns {boolean} Whether the tournament should end
   */
  shouldEnd(): boolean {
    // Check if tournament has a duration and it's expired
    if (this.endTime && Date.now() >= this.endTime) {
      return true;
    }

    // Check if tournament has a fixed number of rounds and they're completed
    if (this.type === TournamentTypeEnum.SWISS && this.rounds !== undefined && this.currentRound !== undefined) {
      return this.currentRound >= this.rounds;
    }

    // Check if elimination tournament has completed all rounds
    if (this.type === TournamentTypeEnum.ELIMINATION && this.currentRound !== undefined) {
      const totalRounds = (this.pairingSystem as EliminationPairingSystem).getTotalRounds();
      return this.currentRound >= totalRounds;
    }

    // Check if round robin tournament has completed all rounds
    if (this.type === TournamentTypeEnum.ROUND_ROBIN && this.currentRound !== undefined) {
      const totalRounds = (this.pairingSystem as RoundRobinPairingSystem).getTotalRounds();
      return this.currentRound >= totalRounds;
    }

    return false;
  }

  /**
   * Start the pairing interval
   */
  private startPairingInterval(): void {
    if (this.pairingInterval) {
      clearInterval(this.pairingInterval);
    }

    // Handle different tournament types
    if (this.type === TournamentTypeEnum.SWISS) {
      // Start the first round immediately
      this.startNextSwissRound();

      // Check periodically if the round is complete to start the next round
      this.pairingInterval = setInterval(() => {
        // Check if tournament should end
        if (this.shouldEnd()) {
          this.end();
          return;
        }

        // If the current round is complete, start the next round
        if ((this.pairingSystem as SwissPairingSystem).isRoundComplete()) {
          this.startNextSwissRound();
        }
      }, this.config.pairing.pairingIntervalSeconds * 1000);
    } else if (this.type === TournamentTypeEnum.ELIMINATION) {
      // Initialize brackets for elimination tournament
      if (this.currentRound === 0) {
        (this.pairingSystem as EliminationPairingSystem).initializeBrackets();
      }

      // Start the first round immediately
      this.startNextEliminationRound();

      // Check periodically if the round is complete to start the next round
      this.pairingInterval = setInterval(() => {
        // Check if tournament should end
        if (this.shouldEnd()) {
          this.end();
          return;
        }

        // If the current round is complete, start the next round
        if ((this.pairingSystem as EliminationPairingSystem).isRoundComplete()) {
          console.log(`Elimination round ${this.currentRound} complete, starting next round...`);
          this.startNextEliminationRound();
        }
      }, 1000); // Check more frequently (every second) for elimination tournaments
    } else if (this.type === TournamentTypeEnum.ROUND_ROBIN) {
      // Initialize schedule for round robin tournament
      if (this.currentRound === 0) {
        (this.pairingSystem as RoundRobinPairingSystem).initializeSchedule();
      }

      // Start the first round immediately
      this.startNextRoundRobinRound();

      // Check periodically if the round is complete to start the next round
      this.pairingInterval = setInterval(() => {
        // Check if tournament should end
        if (this.shouldEnd()) {
          this.end();
          return;
        }

        // If the current round is complete, start the next round
        if ((this.pairingSystem as RoundRobinPairingSystem).isRoundComplete()) {
          console.log(`Round ${this.currentRound} complete, starting next round...`);
          this.startNextRoundRobinRound();
        }
      }, 1000); // Check more frequently (every second) for round robin tournaments
    } else {
      // Arena tournament - run continuous pairing cycles
      this.pairingInterval = setInterval(() => {
        // Check if tournament should end
        if (this.shouldEnd()) {
          this.end();
          return;
        }

        // Run pairing cycle
        (this.pairingSystem as PairingSystem).runPairingCycle();
      }, this.config.pairing.pairingIntervalSeconds * 1000);
    }
  }

  /**
   * Start the next round in a Swiss tournament
   * @returns {boolean} Whether the next round was started
   */
  private startNextSwissRound(): boolean {
    if (this.type !== TournamentTypeEnum.SWISS || this.status !== TournamentStatus.RUNNING) {
      return false;
    }

    // Check if we've reached the maximum number of rounds
    if (this.rounds !== undefined && this.currentRound !== undefined && this.currentRound >= this.rounds) {
      this.end();
      return false;
    }

    // Start the next round
    const pairings = (this.pairingSystem as SwissPairingSystem).startNewRound();
    this.currentRound = (this.pairingSystem as SwissPairingSystem).getCurrentRound();

    return pairings.length > 0;
  }

  /**
   * Start the next round in an Elimination tournament
   * @returns {boolean} Whether the next round was started
   */
  private startNextEliminationRound(): boolean {
    if (this.type !== TournamentTypeEnum.ELIMINATION || this.status !== TournamentStatus.RUNNING) {
      return false;
    }

    // Check if we've reached the maximum number of rounds
    const totalRounds = (this.pairingSystem as EliminationPairingSystem).getTotalRounds();
    if (this.currentRound !== undefined && this.currentRound >= totalRounds) {
      console.log(`Reached maximum rounds (${totalRounds}), ending tournament`);
      this.end();
      return false;
    }

    // Start the next round
    const pairings = (this.pairingSystem as EliminationPairingSystem).startNewRound();
    this.currentRound = (this.pairingSystem as EliminationPairingSystem).getCurrentRound();

    console.log(`Started elimination round ${this.currentRound} with ${pairings.length} pairings`);

    // If no pairings were created, try to end the tournament
    if (pairings.length === 0) {
      console.log('No pairings created, ending tournament');
      this.end();
      return false;
    }

    return true;
  }

  /**
   * Start the next round in a Round Robin tournament
   * @returns {boolean} Whether the next round was started
   */
  private startNextRoundRobinRound(): boolean {
    if (this.type !== TournamentTypeEnum.ROUND_ROBIN || this.status !== TournamentStatus.RUNNING) {
      return false;
    }

    // Check if we've reached the maximum number of rounds
    const totalRounds = (this.pairingSystem as RoundRobinPairingSystem).getTotalRounds();
    if (this.currentRound !== undefined && this.currentRound >= totalRounds) {
      this.end();
      return false;
    }

    // Start the next round
    const pairings = (this.pairingSystem as RoundRobinPairingSystem).startNewRound();
    this.currentRound = (this.pairingSystem as RoundRobinPairingSystem).getCurrentRound();

    // If no pairings were created, try to end the tournament
    if (pairings.length === 0) {
      this.end();
      return false;
    }

    return true;
  }

  /**
   * Stop the pairing interval
   */
  private stopPairingInterval(): void {
    if (this.pairingInterval) {
      clearInterval(this.pairingInterval);
      this.pairingInterval = undefined;
    }
  }

  /**
   * Convert the tournament to a plain object
   * @returns {TournamentType} The tournament as a plain object
   */
  toJSON(): TournamentType {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      type: this.type,
      status: this.status,
      config: this.config,
      createdAt: this.createdAt,
      startTime: this.startTime,
      endTime: this.endTime,
      durationMinutes: this.durationMinutes,
      rounds: this.rounds,
      currentRound: this.currentRound,
      minRating: this.minRating,
      maxRating: this.maxRating,
      isPrivate: this.isPrivate,
      password: this.password,
      organizerId: this.organizerId
    };
  }
}
