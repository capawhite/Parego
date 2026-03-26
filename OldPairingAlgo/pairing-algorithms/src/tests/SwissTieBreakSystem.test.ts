import { SwissTieBreakSystem } from '../algorithms/SwissTieBreakSystem';
import { Player } from '../models/Player';
import { Pairing } from '../models/Pairing';
import { Result } from '../types/pairing';
import { TieBreakSystem } from '../types/tournament';

describe('SwissTieBreakSystem', () => {
  let players: Map<string, Player>;
  let pairings: Pairing[];
  let tieBreakSystem: SwissTieBreakSystem;

  beforeEach(() => {
    // Create test players
    players = new Map();

    const player1 = new Player({ id: 'p1', name: 'Player 1', rating: 1800 });
    player1.score = 3;
    players.set('p1', player1);

    const player2 = new Player({ id: 'p2', name: 'Player 2', rating: 1700 });
    player2.score = 3;
    players.set('p2', player2);

    const player3 = new Player({ id: 'p3', name: 'Player 3', rating: 1600 });
    player3.score = 2;
    players.set('p3', player3);

    const player4 = new Player({ id: 'p4', name: 'Player 4', rating: 1500 });
    player4.score = 1;
    players.set('p4', player4);

    const player5 = new Player({ id: 'p5', name: 'Player 5', rating: 1400 });
    player5.score = 1;
    players.set('p5', player5);

    // Create test pairings
    pairings = [
      // Round 1
      new Pairing({ tournamentId: 'test', whiteId: 'p1', blackId: 'p2', round: 1, boardNumber: 1 }),
      new Pairing({ tournamentId: 'test', whiteId: 'p3', blackId: 'p4', round: 1, boardNumber: 2 }),
      new Pairing({ tournamentId: 'test', whiteId: 'p5', blackId: 'p5', round: 1, boardNumber: 0 }), // Bye

      // Round 2
      new Pairing({ tournamentId: 'test', whiteId: 'p1', blackId: 'p3', round: 2, boardNumber: 1 }),
      new Pairing({ tournamentId: 'test', whiteId: 'p2', blackId: 'p5', round: 2, boardNumber: 2 }),
      new Pairing({ tournamentId: 'test', whiteId: 'p4', blackId: 'p4', round: 2, boardNumber: 0 }), // Bye

      // Round 3
      new Pairing({ tournamentId: 'test', whiteId: 'p1', blackId: 'p5', round: 3, boardNumber: 1 }),
      new Pairing({ tournamentId: 'test', whiteId: 'p2', blackId: 'p4', round: 3, boardNumber: 2 }),
      new Pairing({ tournamentId: 'test', whiteId: 'p3', blackId: 'p3', round: 3, boardNumber: 0 }), // Bye
    ];

    // Set results
    // Round 1
    pairings[0].setResult(Result.DRAW); // p1 vs p2: Draw
    pairings[1].setResult(Result.WHITE_WIN); // p3 vs p4: p3 wins
    pairings[2].setResult(Result.BYE); // p5 gets a bye

    // Round 2
    pairings[3].setResult(Result.WHITE_WIN); // p1 vs p3: p1 wins
    pairings[4].setResult(Result.WHITE_WIN); // p2 vs p5: p2 wins
    pairings[5].setResult(Result.BYE); // p4 gets a bye

    // Round 3
    pairings[6].setResult(Result.WHITE_WIN); // p1 vs p5: p1 wins
    pairings[7].setResult(Result.WHITE_WIN); // p2 vs p4: p2 wins
    pairings[8].setResult(Result.BYE); // p3 gets a bye

    // Add opponents
    player1.addOpponent('p2');
    player1.addOpponent('p3');
    player1.addOpponent('p5');

    player2.addOpponent('p1');
    player2.addOpponent('p5');
    player2.addOpponent('p4');

    player3.addOpponent('p4');
    player3.addOpponent('p1');

    player4.addOpponent('p3');
    player4.addOpponent('p2');

    player5.addOpponent('p2');
    player5.addOpponent('p1');

    // Create tie break system
    tieBreakSystem = new SwissTieBreakSystem(players, pairings, true); // Count byes as draws
  });

  describe('calculateTieBreaks', () => {
    it('should calculate correct tie breaks for players with byes counted as draws', () => {
      const player1 = players.get('p1')!;
      const tieBreaks = tieBreakSystem.calculateTieBreaks(player1);

      // Player 1 played against p2 (3 points), p3 (2 points), p5 (1 point)
      // Buchholz should be 3 + 2 + 1 = 6
      expect(tieBreaks.buchholz).toBe(6);

      // Player 1 won 2 games and drew 1
      expect(tieBreaks.wins).toBe(2);

      // SB: p1 drew with p2 (3 points), won against p3 (2 points), won against p5 (1 point)
      // SB should be 3/2 + 2 + 1 = 4.5
      expect(tieBreaks.sonnebornBerger).toBe(4.5);
    });

    it('should calculate correct tie breaks for players with byes', () => {
      // Create a tie break system that counts byes as wins
      const tieBreakSystemWithWinByes = new SwissTieBreakSystem(players, pairings, false);

      const player5 = players.get('p5')!;
      const tieBreaks = tieBreakSystemWithWinByes.calculateTieBreaks(player5);

      // Player 5 had a bye in round 1, then played against p2 and p1
      // With byes counted as wins, wins should be 1 (the bye)
      expect(tieBreaks.wins).toBe(1);

      // Now check with byes counted as draws
      const tieBreaksWithDrawByes = tieBreakSystem.calculateTieBreaks(player5);

      // With byes counted as draws, wins should be 0
      expect(tieBreaksWithDrawByes.wins).toBe(0);
    });
  });

  describe('compareTieBreak', () => {
    it('should correctly compare players using Buchholz tie break', () => {
      const player1 = players.get('p1')!;
      const player2 = players.get('p2')!;

      const tieBreaks1 = tieBreakSystem.calculateTieBreaks(player1);
      const tieBreaks2 = tieBreakSystem.calculateTieBreaks(player2);

      const playerWithStats1 = {
        ...player1.toJSON(),
        tiebreaks: tieBreaks1
      };

      const playerWithStats2 = {
        ...player2.toJSON(),
        tiebreaks: tieBreaks2
      };

      // Player 2 has higher Buchholz (played against p1, p5, p4)
      // p1 has 3 points, p5 has 1 point, p4 has 1 point
      // Total: 5 points
      // Player 1 has Buchholz of 6 points
      // So player 1 should be better
      const comparison = tieBreakSystem.compareTieBreak(
        playerWithStats1,
        playerWithStats2,
        TieBreakSystem.BUCHHOLZ
      );

      // Negative means player1 is better
      expect(comparison).toBeLessThan(0);
    });
  });
});
