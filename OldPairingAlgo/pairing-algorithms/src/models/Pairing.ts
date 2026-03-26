import { Pairing as PairingType, Result } from '../types/pairing';
import { v4 as uuidv4 } from 'uuid';

/**
 * Pairing class for the pairing algorithm
 * Extends the shared Pairing type with additional methods
 */
export class Pairing implements Omit<PairingType, 'id'> {
  id: string;
  tournamentId: string;
  whiteId: string;
  blackId: string;
  startTime: number;
  endTime?: number;
  result: Result;
  round?: number;
  boardNumber?: number;

  constructor(data: {
    tournamentId: string;
    whiteId: string;
    blackId: string;
    round?: number;
    boardNumber?: number;
    id?: string;
  }) {
    this.id = data.id || uuidv4();
    this.tournamentId = data.tournamentId;
    this.whiteId = data.whiteId;
    this.blackId = data.blackId;
    this.startTime = Date.now();
    this.result = Result.ONGOING;
    this.round = data.round;
    this.boardNumber = data.boardNumber;
  }

  /**
   * Set the result of the pairing
   * @param {Result} result - The result of the game
   */
  setResult(result: Result): void {
    this.result = result;
    this.endTime = Date.now();
  }

  /**
   * Finish the game with a result
   * @param {Result} result - The result of the game
   */
  finishGame(result: Result): void {
    if (this.result !== Result.ONGOING) {
      throw new Error('Game is already finished');
    }

    this.result = result;
    this.endTime = Date.now();
  }

  /**
   * Get the duration of the game in seconds
   * @returns {number} The duration in seconds
   */
  getDurationSeconds(): number {
    const endTime = this.endTime || Date.now();
    return (endTime - this.startTime) / 1000;
  }

  /**
   * Check if the game is finished
   * @returns {boolean} Whether the game is finished
   */
  isFinished(): boolean {
    return this.result !== Result.ONGOING;
  }

  /**
   * Convert the pairing to a plain object
   * @returns {PairingType} The pairing as a plain object
   */
  toJSON(): PairingType {
    return {
      id: this.id,
      tournamentId: this.tournamentId,
      whiteId: this.whiteId,
      blackId: this.blackId,
      startTime: this.startTime,
      endTime: this.endTime,
      result: this.result,
      round: this.round,
      boardNumber: this.boardNumber
    };
  }
}
