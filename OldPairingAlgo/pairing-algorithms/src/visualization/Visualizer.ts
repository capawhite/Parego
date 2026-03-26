import { Tournament } from '../models/Tournament';
import { Player } from '../models/Player';
import { Pairing } from '../models/Pairing';
import { Result } from '../types/pairing';
import { TournamentType, TieBreakSystem } from '../types/tournament';
import { SwissPairingSystem } from '../algorithms/SwissPairingSystem';
import { EliminationPairingSystem } from '../algorithms/EliminationPairingSystem';
import { PlayerWithStats } from '../types/player';

/**
 * Base class for tournament visualization
 */
export class Visualizer {
  protected tournament: Tournament;

  /**
   * Create a new visualizer
   * @param {Tournament} tournament - The tournament to visualize
   */
  constructor(tournament: Tournament) {
    this.tournament = tournament;
  }

  /**
   * Generate a standings table
   * @param {boolean} showByes - Whether to show bye information
   * @param {boolean} showTieBreaks - Whether to show tie break information
   * @returns {string} The standings table as a string
   */
  generateStandingsTable(showByes: boolean = true, showTieBreaks: boolean = true): string {
    const standings = this.tournament.getStandings();
    const isSwiss = this.tournament.type === TournamentType.SWISS;
    const hasDetailedStats = isSwiss && Array.isArray(standings) && 'tiebreaks' in standings[0];

    // Build the header
    let table = '| Rank | Name | Rating | Score | Games | W-D-L |';

    // Add bye column for Swiss tournaments
    if (showByes && isSwiss) {
      table += ' Byes |';
    }

    // Add tie break columns for Swiss tournaments
    if (showTieBreaks && hasDetailedStats) {
      table += ' Buchholz | M-Buchholz | SB | Wins |';
    }

    table += '\n|------|------|--------|-------|-------|-------|';

    // Add bye column separator for Swiss tournaments
    if (showByes && isSwiss) {
      table += '------|';
    }

    // Add tie break column separators for Swiss tournaments
    if (showTieBreaks && hasDetailedStats) {
      table += '----------|------------|----|----|';
    }

    table += '\n';

    // Build the rows
    if (hasDetailedStats) {
      // Handle PlayerWithStats array
      const typedStandings = standings as PlayerWithStats[];

      typedStandings.forEach((player, index) => {
        const playerObj = this.tournament.getPlayer(player.id);
        const wins = playerObj ? this.getPlayerWins(playerObj) : 0;
        const draws = playerObj ? this.getPlayerDraws(playerObj) : 0;
        const losses = playerObj ? this.getPlayerLosses(playerObj) : 0;

        table += `| ${index + 1} | ${player.name} | ${player.rating} | ${player.score} | ${player.gamesPlayed} | ${wins}-${draws}-${losses} |`;

        // Add bye information for Swiss tournaments
        if (showByes && isSwiss) {
          const byeCount = this.getPlayerByeCount(player.id);
          table += ` ${byeCount} |`;
        }

        // Add tie break information for Swiss tournaments
        if (showTieBreaks && player.tiebreaks) {
          table += ` ${player.tiebreaks.buchholz?.toFixed(1) || '-'} | ${player.tiebreaks.medianBuchholz?.toFixed(1) || '-'} | ${player.tiebreaks.sonnebornBerger?.toFixed(1) || '-'} | ${player.tiebreaks.wins || '-'} |`;
        }

        table += '\n';
      });
    } else {
      // Handle [Player, number] array
      const typedStandings = standings as Array<[Player, number]>;

      typedStandings.forEach(([player, score], index) => {
        const wins = this.getPlayerWins(player);
        const draws = this.getPlayerDraws(player);
        const losses = this.getPlayerLosses(player);

        table += `| ${index + 1} | ${player.name} | ${player.rating} | ${score} | ${player.gamesPlayed} | ${wins}-${draws}-${losses} |`;

        // Add bye information for Swiss tournaments
        if (showByes && isSwiss) {
          const byeCount = this.getPlayerByeCount(player.id);
          table += ` ${byeCount} |`;
        }

        table += '\n';
      });
    }

    return table;
  }

  /**
   * Generate a pairings table for the current round
   * @returns {string} The pairings table as a string
   */
  generatePairingsTable(): string {
    const pairings = this.tournament.getActivePairings();

    // Build the header
    let table = '| Board | White | Rating | Black | Rating | Result |\n';
    table += '|-------|-------|--------|-------|--------|--------|\n';

    // Build the rows
    pairings.forEach(pairing => {
      const whitePlayer = this.tournament.getPlayer(pairing.whiteId);
      const blackPlayer = this.tournament.getPlayer(pairing.blackId);

      if (whitePlayer && blackPlayer) {
        table += `| ${pairing.boardNumber || '-'} | ${whitePlayer.name} | ${whitePlayer.rating} | ${blackPlayer.name} | ${blackPlayer.rating} | ${this.formatResult(pairing.result)} |\n`;
      }
    });

    return table;
  }

  /**
   * Generate a cross-table showing all pairings
   * @returns {string} The cross-table as a string
   */
  generateCrossTable(): string {
    const players = this.tournament.getActivePlayers();
    const finishedPairings = this.tournament.getFinishedPairings();

    // Sort players by score
    players.sort((a, b) => b.score - a.score);

    // Build the header
    let table = '| # | Name | Rating |';

    // Add player columns
    players.forEach((_, index) => {
      table += ` ${index + 1} |`;
    });

    // Add score column
    table += ' Score |\n|---|------|--------|';

    // Add player column separators
    players.forEach(() => {
      table += '---|';
    });

    // Add score column separator
    table += '-------|\n';

    // Build the rows
    players.forEach((player, rowIndex) => {
      table += `| ${rowIndex + 1} | ${player.name} | ${player.rating} |`;

      // Add results against each player
      players.forEach((opponent, colIndex) => {
        if (rowIndex === colIndex) {
          // Diagonal (player vs themselves)
          table += ' X |';
        } else {
          // Find pairing between these players
          const result = this.getResultBetweenPlayers(player.id, opponent.id, finishedPairings);
          table += ` ${result} |`;
        }
      });

      // Add score
      table += ` ${player.score} |\n`;
    });

    return table;
  }

  /**
   * Generate a bye report for Swiss tournaments
   * @returns {string} The bye report as a string
   */
  generateByeReport(): string {
    if (this.tournament.type !== TournamentType.SWISS) {
      return 'Bye report is only available for Swiss tournaments.';
    }

    const pairingSystem = this.tournament.getPairingSystem() as SwissPairingSystem;
    const byePairings = pairingSystem.getByePairings();

    if (byePairings.length === 0) {
      return 'No byes have been awarded in this tournament.';
    }

    // Build the header
    let report = '| Round | Player | Rating |\n';
    report += '|-------|--------|--------|\n';

    // Sort by round
    byePairings.sort((a, b) => (a.round || 0) - (b.round || 0));

    // Build the rows
    byePairings.forEach(pairing => {
      const player = this.tournament.getPlayer(pairing.whiteId);

      if (player) {
        report += `| ${pairing.round || '-'} | ${player.name} | ${player.rating} |\n`;
      }
    });

    return report;
  }

  /**
   * Get the number of wins for a player
   * @param {Player} player - The player
   * @returns {number} The number of wins
   */
  private getPlayerWins(player: Player): number {
    const finishedPairings = this.tournament.getFinishedPairings();

    return finishedPairings.filter(pairing =>
      (pairing.whiteId === player.id && pairing.result === Result.WHITE_WIN) ||
      (pairing.blackId === player.id && pairing.result === Result.BLACK_WIN)
    ).length;
  }

  /**
   * Get the number of draws for a player
   * @param {Player} player - The player
   * @returns {number} The number of draws
   */
  private getPlayerDraws(player: Player): number {
    const finishedPairings = this.tournament.getFinishedPairings();

    return finishedPairings.filter(pairing =>
      ((pairing.whiteId === player.id || pairing.blackId === player.id) && pairing.result === Result.DRAW) ||
      (pairing.whiteId === player.id && pairing.blackId === player.id && pairing.result === Result.BYE)
    ).length;
  }

  /**
   * Get the number of losses for a player
   * @param {Player} player - The player
   * @returns {number} The number of losses
   */
  private getPlayerLosses(player: Player): number {
    const finishedPairings = this.tournament.getFinishedPairings();

    return finishedPairings.filter(pairing =>
      (pairing.whiteId === player.id && pairing.result === Result.BLACK_WIN) ||
      (pairing.blackId === player.id && pairing.result === Result.WHITE_WIN)
    ).length;
  }

  /**
   * Get the number of byes a player has received
   * @param {string} playerId - The ID of the player
   * @returns {number} The number of byes
   */
  private getPlayerByeCount(playerId: string): number {
    if (this.tournament.type !== TournamentType.SWISS) {
      return 0;
    }

    const pairingSystem = this.tournament.getPairingSystem() as SwissPairingSystem;
    return pairingSystem.getPlayerByeCount(playerId);
  }

  /**
   * Format a result for display
   * @param {Result} result - The result to format
   * @returns {string} The formatted result
   */
  private formatResult(result: Result): string {
    switch (result) {
      case Result.WHITE_WIN:
        return '1-0';
      case Result.BLACK_WIN:
        return '0-1';
      case Result.DRAW:
        return '½-½';
      case Result.BYE:
        return 'BYE';
      case Result.ONGOING:
        return '*';
      default:
        return '?';
    }
  }

  /**
   * Get the result between two players
   * @param {string} player1Id - The ID of the first player
   * @param {string} player2Id - The ID of the second player
   * @param {Pairing[]} pairings - The pairings to search
   * @returns {string} The formatted result
   */
  private getResultBetweenPlayers(player1Id: string, player2Id: string, pairings: Pairing[]): string {
    // Find pairing between these players
    const pairing = pairings.find(p =>
      (p.whiteId === player1Id && p.blackId === player2Id) ||
      (p.whiteId === player2Id && p.blackId === player1Id)
    );

    if (!pairing) {
      return '-';
    }

    // Format result from player1's perspective
    if (pairing.whiteId === player1Id) {
      switch (pairing.result) {
        case Result.WHITE_WIN:
          return '1';
        case Result.BLACK_WIN:
          return '0';
        case Result.DRAW:
          return '½';
        case Result.ONGOING:
          return '*';
        default:
          return '?';
      }
    } else {
      switch (pairing.result) {
        case Result.WHITE_WIN:
          return '0';
        case Result.BLACK_WIN:
          return '1';
        case Result.DRAW:
          return '½';
        case Result.ONGOING:
          return '*';
        default:
          return '?';
      }
    }
  }
  /**
   * Convert standings to an ASCII table (static method)
   * @param {Array<[Player, number]> | Array<PlayerWithStats>} standings - The standings to convert
   * @returns {string} The ASCII table
   */
  static standingsToAsciiTable(standings: Array<[Player, number]> | Array<PlayerWithStats>): string {
    const hasDetailedStats = Array.isArray(standings) && 'tiebreaks' in standings[0];

    if (hasDetailedStats) {
      // Handle PlayerWithStats array
      const typedStandings = standings as PlayerWithStats[];

      // Build the header
      let table = '+------+------------------+--------+-------+-------+-------+----------+------------+------+------+\n';
      table += '| Rank  | Name             | Rating | Score | Games | W-D-L | Buchholz | M-Buchholz | SB   | Wins |\n';
      table += '+------+------------------+--------+-------+-------+-------+----------+------------+------+------+\n';

      // Build the rows
      typedStandings.forEach((player, index) => {
        const wins = player.tiebreaks?.wins || 0;
        const draws = player.gamesPlayed - wins - (player.previousOpponents.length - wins);
        const losses = player.previousOpponents.length - wins;

        let row = `| ${(index + 1).toString().padEnd(4)} | ${player.name.padEnd(16)} | ${player.rating.toString().padEnd(6)} | ${player.score.toString().padEnd(5)} | ${player.gamesPlayed.toString().padEnd(5)} | ${wins}-${draws}-${losses} |`;

        // Add tie break information
        if (player.tiebreaks) {
          row += ` ${(player.tiebreaks.buchholz?.toFixed(1) || '-').padEnd(8)} | ${(player.tiebreaks.medianBuchholz?.toFixed(1) || '-').padEnd(10)} | ${(player.tiebreaks.sonnebornBerger?.toFixed(1) || '-').padEnd(4)} | ${(player.tiebreaks.wins?.toString() || '-').padEnd(4)} |`;
        } else {
          row += ' '.padEnd(8) + '| ' + ' '.padEnd(10) + '| ' + ' '.padEnd(4) + '| ' + ' '.padEnd(4) + '|';
        }

        table += row + '\n';
      });

      table += '+------+------------------+--------+-------+-------+-------+----------+------------+------+------+\n';

      return table;
    } else {
      // Handle [Player, number] array
      const typedStandings = standings as Array<[Player, number]>;

      // Build the header
      let table = '+------+------------------+--------+-------+-------+-------+\n';
      table += '| Rank  | Name             | Rating | Score | Games | W-D-L |\n';
      table += '+------+------------------+--------+-------+-------+-------+\n';

      // Build the rows
      typedStandings.forEach(([player, score], index) => {
        const wins = player.gamesPlayed - player.previousOpponents.length;
        const draws = 0; // Simplified for now
        const losses = player.previousOpponents.length - wins;

        table += `| ${(index + 1).toString().padEnd(4)} | ${player.name.padEnd(16)} | ${player.rating.toString().padEnd(6)} | ${score.toString().padEnd(5)} | ${player.gamesPlayed.toString().padEnd(5)} | ${wins}-${draws}-${losses} |\n`;
      });

      table += '+------+------------------+--------+-------+-------+-------+\n';

      return table;
    }
  }

  /**
   * Convert pairings to an ASCII table (static method)
   * @param {Pairing[]} pairings - The pairings to convert
   * @param {Tournament} tournament - The tournament
   * @returns {string} The ASCII table
   */
  static pairingsToAsciiTable(pairings: Pairing[], tournament: Tournament): string {
    // Build the header
    let table = '+-------+------------------+--------+------------------+--------+--------+\n';
    table += '| Board  | White            | Rating | Black            | Rating | Result |\n';
    table += '+-------+------------------+--------+------------------+--------+--------+\n';

    // Build the rows
    pairings.forEach(pairing => {
      const whitePlayer = tournament.getPlayer(pairing.whiteId);
      const blackPlayer = tournament.getPlayer(pairing.blackId);

      if (whitePlayer && blackPlayer) {
        const result = this.formatResultStatic(pairing.result);
        table += `| ${(pairing.boardNumber || '-').toString().padEnd(5)} | ${whitePlayer.name.padEnd(16)} | ${whitePlayer.rating.toString().padEnd(6)} | ${blackPlayer.name.padEnd(16)} | ${blackPlayer.rating.toString().padEnd(6)} | ${result.padEnd(6)} |\n`;
      }
    });

    table += '+-------+------------------+--------+------------------+--------+--------+\n';

    return table;
  }

  /**
   * Convert a tournament bracket to ASCII art (static method)
   * @param {Tournament} tournament - The tournament
   * @returns {string} The ASCII bracket
   */
  static bracketToAscii(tournament: Tournament): string {
    if (tournament.type !== TournamentType.ELIMINATION) {
      return 'Bracket visualization is only available for Elimination tournaments.';
    }

    const pairingSystem = tournament.getPairingSystem() as EliminationPairingSystem;
    const brackets = pairingSystem.getBrackets();

    if (!brackets || brackets.length === 0) {
      return 'No bracket data available.';
    }

    let output = '';
    const totalRounds = brackets.length;

    // Calculate the width needed for each round
    const playerNameWidth = 16;
    const matchWidth = playerNameWidth * 2 + 3; // 2 players + ' vs '
    const roundWidth = matchWidth + 4; // Some padding

    // Generate the bracket visualization
    for (let round = 0; round < totalRounds; round++) {
      const bracket = brackets[round];
      const matches = bracket.matches;

      output += `Round ${round + 1}:\n`;
      output += ''.padEnd(roundWidth * round, ' ');

      for (const match of matches) {
        const player1 = tournament.getPlayer(match.player1Id || '');
        const player2 = tournament.getPlayer(match.player2Id || '');

        let matchText = '';
        if (player1 && player2) {
          matchText = `${player1.name} vs ${player2.name}`;
          if (match.winnerId) {
            const winner = tournament.getPlayer(match.winnerId);
            if (winner) {
              matchText += ` (${winner.name} won)`;
            }
          }
        } else if (player1) {
          matchText = `${player1.name} (bye)`;
        } else if (player2) {
          matchText = `${player2.name} (bye)`;
        } else {
          matchText = 'TBD vs TBD';
        }

        output += matchText.padEnd(matchWidth, ' ');
        output += '  ';
      }

      output += '\n\n';
    }

    return output;
  }

  /**
   * Format a result for display (static method)
   * @param {Result} result - The result to format
   * @returns {string} The formatted result
   */
  private static formatResultStatic(result: Result): string {
    switch (result) {
      case Result.WHITE_WIN:
        return '1-0';
      case Result.BLACK_WIN:
        return '0-1';
      case Result.DRAW:
        return '½-½';
      case Result.BYE:
        return 'BYE';
      case Result.ONGOING:
        return '*';
      default:
        return '?';
    }
  }
}