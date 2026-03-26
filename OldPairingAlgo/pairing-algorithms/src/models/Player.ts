import { Player as PlayerType } from '../types/player';

/**
 * Player class for the pairing algorithm
 * Extends the shared Player type with additional methods
 */
export class Player implements PlayerType {
  id: string;
  name: string;
  rating: number;
  team?: string;
  score: number;
  gamesPlayed: number;
  isActive: boolean;
  isWaiting: boolean;
  waitingSince: number;
  whiteCount: number;
  blackCount: number;
  currentStreak: number;
  previousOpponents: string[];
  // Using a Map for internal storage, but will convert to Record when needed
  private tiebreakMap: Map<string, number> = new Map();

  constructor(data: Partial<PlayerType> & { id: string; name: string; rating: number }) {
    this.id = data.id;
    this.name = data.name;
    this.rating = data.rating;
    this.team = data.team;
    this.score = data.score || 0;
    this.gamesPlayed = data.gamesPlayed || 0;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.isWaiting = data.isWaiting || false;
    this.waitingSince = data.waitingSince || 0;
    this.whiteCount = data.whiteCount || 0;
    this.blackCount = data.blackCount || 0;
    this.currentStreak = data.currentStreak || 0;
    this.previousOpponents = data.previousOpponents || [];
  }

  /**
   * Start waiting for a game
   * @returns {boolean} Whether the player started waiting
   */
  startWaiting(): boolean {
    if (this.isActive && !this.isWaiting) {
      this.isWaiting = true;
      this.waitingSince = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Stop waiting for a game
   */
  stopWaiting(): void {
    this.isWaiting = false;
    this.waitingSince = 0;
  }

  /**
   * Add an opponent to the player's history
   * @param {string} opponentId - The ID of the opponent
   */
  addOpponent(opponentId: string): void {
    if (!this.previousOpponents.includes(opponentId)) {
      this.previousOpponents.push(opponentId);
    }
  }

  /**
   * Check if the player has played against an opponent
   * @param {string} opponentId - The ID of the opponent
   * @returns {boolean} Whether the player has played against the opponent
   */
  hasPlayedAgainst(opponentId: string): boolean {
    return this.previousOpponents.includes(opponentId);
  }

  /**
   * Get the player's color balance
   * @returns {number} The color balance (positive for more white, negative for more black)
   */
  getColorBalance(): number {
    return this.whiteCount - this.blackCount;
  }

  /**
   * Get the player's preferred color based on color balance
   * @returns {'white' | 'black'} The preferred color
   */
  getPreferredColor(): 'white' | 'black' {
    const balance = this.getColorBalance();
    if (balance < 0) {
      return 'white';
    } else if (balance > 0) {
      return 'black';
    } else {
      // If balanced, return random color
      return Math.random() < 0.5 ? 'white' : 'black';
    }
  }

  /**
   * Update the player's score and streak
   * @param {number} points - The points to add
   */
  addScore(points: number): void {
    this.score += points;
    this.gamesPlayed += 1;

    // Update streak
    if (points === 1) {
      // Win
      this.currentStreak = this.currentStreak > 0 ? this.currentStreak + 1 : 1;
    } else if (points === 0) {
      // Loss
      this.currentStreak = this.currentStreak < 0 ? this.currentStreak - 1 : -1;
    } else {
      // Draw
      this.currentStreak = 0;
    }
  }

  /**
   * Increment the player's white count
   */
  incrementWhiteCount(): void {
    this.whiteCount += 1;
  }

  /**
   * Increment the player's black count
   */
  incrementBlackCount(): void {
    this.blackCount += 1;
  }

  /**
   * Get the player's waiting time in seconds
   * @returns {number} The waiting time in seconds
   */
  getWaitingTimeSeconds(): number {
    if (!this.isWaiting) {
      return 0;
    }
    return (Date.now() - this.waitingSince) / 1000;
  }

  /**
   * Get the number of games played
   * @returns {number} The number of games played
   */
  getGamesPlayed(): number {
    return this.gamesPlayed;
  }

  /**
   * Set a tiebreak value
   * @param {string} name - The name of the tiebreak
   * @param {number} value - The value of the tiebreak
   */
  setTiebreak(name: string, value: number): void {
    this.tiebreakMap.set(name, value);
  }

  /**
   * Get a tiebreak value
   * @param {string} name - The name of the tiebreak
   * @returns {number | undefined} The value of the tiebreak, or undefined if not set
   */
  getTiebreak(name: string): number | undefined {
    return this.tiebreakMap.get(name);
  }

  /**
   * Increment a tiebreak value
   * @param {string} name - The name of the tiebreak
   * @param {number} increment - The amount to increment by (default: 1)
   */
  incrementTiebreak(name: string, increment: number = 1): void {
    const currentValue = this.tiebreakMap.get(name) || 0;
    this.tiebreakMap.set(name, currentValue + increment);
  }

  /**
   * Clear all tiebreaks
   */
  clearTiebreaks(): void {
    this.tiebreakMap.clear();
  }

  /**
   * Get all tiebreaks as a Record
   * @returns {Record<string, number>} All tiebreaks
   */
  getTiebreaks(): Record<string, number> {
    const tiebreaks: Record<string, number> = {};
    this.tiebreakMap.forEach((value, key) => {
      tiebreaks[key] = value;
    });
    return tiebreaks;
  }

  /**
   * Convert the player to a plain object
   * @returns {PlayerType} The player as a plain object
   */
  toJSON(): PlayerType {
    return {
      id: this.id,
      name: this.name,
      rating: this.rating,
      team: this.team,
      score: this.score,
      gamesPlayed: this.gamesPlayed,
      isActive: this.isActive,
      isWaiting: this.isWaiting,
      waitingSince: this.waitingSince,
      whiteCount: this.whiteCount,
      blackCount: this.blackCount,
      currentStreak: this.currentStreak,
      previousOpponents: [...this.previousOpponents]
    };
  }
}
