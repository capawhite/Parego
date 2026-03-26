/**
 * Represents a color assignment in a game
 */
export enum Color {
  WHITE = 'white',
  BLACK = 'black'
}

/**
 * Represents the result of a game
 */
export enum Result {
  /** White player won */
  WHITE_WIN = 'white_win',

  /** Black player won */
  BLACK_WIN = 'black_win',

  /** Game ended in a draw */
  DRAW = 'draw',

  /** Game is ongoing */
  ONGOING = 'ongoing',

  /** Player received a bye */
  BYE = 'bye'
}

/**
 * Represents a pairing between two players
 */
export interface Pairing {
  /** Unique identifier for the pairing */
  id: string;

  /** ID of the tournament this pairing belongs to */
  tournamentId: string;

  /** ID of the player with white pieces */
  whiteId: string;

  /** ID of the player with black pieces */
  blackId: string;

  /** Timestamp when the pairing was created (milliseconds since epoch) */
  startTime: number;

  /** Timestamp when the game ended (milliseconds since epoch), if applicable */
  endTime?: number;

  /** Result of the game */
  result: Result;

  /** Round number in the tournament, if applicable */
  round?: number;

  /** Board number in the tournament, if applicable */
  boardNumber?: number;
}

/**
 * Pairing with additional player information
 */
export interface PairingWithPlayers extends Pairing {
  /** White player information */
  whitePlayer: {
    id: string;
    name: string;
    rating: number;
    team?: string;
  };

  /** Black player information */
  blackPlayer: {
    id: string;
    name: string;
    rating: number;
    team?: string;
  };
}
