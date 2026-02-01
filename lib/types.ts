export interface Player {
  id: string
  name: string
  score: number
  gamesPlayed: number
  streak: number // consecutive wins
  performance: number // for tiebreaker when scores are equal
  active: boolean // currently available for pairing
  paused: boolean // player is paused and won't be paired
  markedForPause?: boolean // player will be paused after their current match result is entered
  joinedAt: number // timestamp
  opponentIds: string[] // list of opponent IDs in order played
  gameResults: ("W" | "D" | "L")[] // W = win, D = draw, L = loss in order played
  pieceColors: ("white" | "black")[] // piece color for each game
  tableNumbers?: number[] // table number for each game
  markedForRemoval?: boolean // player will be removed after their current match result is entered
  hasLeft?: boolean // player was removed mid-tournament (for leaderboard display)
  userId?: string | null // Link to registered user
  isGuest?: boolean // Flag for guest players
}

export interface Match {
  id: string
  player1: Player
  player2: Player
  tableNumber?: number
  result?: {
    winnerId?: string
    isDraw: boolean
    completed: boolean
    completedAt: number
  }
  player1Submission?: {
    result: "player1-win" | "draw" | "player2-win"
    timestamp: number
    confirmed: boolean
  }
  player2Submission?: {
    result: "player1-win" | "draw" | "player2-win"
    timestamp: number
    confirmed: boolean
  }
  disputeStatus?: "none" | "pending" | "conflict" | "escalated"
  startTime?: number // Timestamp when match was created (pairing time)
  endTime?: number // Timestamp when result was entered
}

export interface Round {
  roundNumber: number
  matches: Match[]
  completedMatches: Match[]
}

export interface TournamentSettings {
  // Scoring
  winPoints: number
  drawPoints: number
  lossPoints: number
  streakEnabled: boolean
  streakMultiplier: number // e.g., 2 for double points

  // Player Management
  allowSelfPause: boolean
  allowLateJoin: boolean
  minGamesBeforePause: number

  // Pairing Rules
  avoidRecentRematches: number // number of recent rounds to avoid rematches
  colorBalancePriority: "low" | "medium" | "high"
  scoreMatchingStrictness: "loose" | "normal" | "strict"

  // Tournament Settings
  tableCount: number
  autoEndAtCompletion: boolean // auto-end when X% of unique pairings complete
  completionThreshold: number // percentage (e.g., 95 for 95%)

  // Time Controls (for Balanced Strength algorithm)
  baseTimeMinutes?: number // Tf - Fixed time per player (max 300 minutes)
  incrementSeconds?: number // Ta - Time increment per move (max 180 seconds)

  pairingAlgorithm?: string // Algorithm ID (e.g., "all-vs-all", "balanced-strength")
}

export const DEFAULT_SETTINGS: TournamentSettings = {
  winPoints: 2,
  drawPoints: 1,
  lossPoints: 0,
  streakEnabled: true,
  streakMultiplier: 2,
  allowSelfPause: true,
  allowLateJoin: true,
  minGamesBeforePause: 0,
  avoidRecentRematches: 3,
  colorBalancePriority: "high",
  scoreMatchingStrictness: "normal",
  tableCount: 0,
  autoEndAtCompletion: false,
  completionThreshold: 95,
  pairingAlgorithm: "all-vs-all", // Default to All vs All
}

export interface ArenaState {
  players: Player[]
  rounds: Round[]
  currentRound: number | null
  pairedMatches: Match[]
  tournamentStartTime: number | null
  tournamentDuration: number // in milliseconds
  isActive: boolean
  allTimeMatches: Match[] // track all pairings for history
  tableCount: number // added table count to track available tables
  settings: TournamentSettings // Added settings to arena state
}
