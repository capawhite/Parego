import { SwissPairingSystem } from './SwissPairingSystem';
import { Player } from '../models/Player';

describe('SwissPairingSystem', () => {
  it('should create a SwissPairingSystem', () => {
    const tournamentId = 'test-tournament';
    const config = {
      pairing: {
        rematchPenalty: 10,
        colorBalanceWeight: 1,
        ratingDiffWeight: 1,
        waitingTimeWeight: 1,
        maxRatingDiff: 100,
        teamPairingPenalty: 20,
        pairingIntervalSeconds: 60,
      },
      scoring: {
        winPoints: 3,
        drawPoints: 1,
        lossPoints: 0,
        usePerformanceRating: false,
        useStreaks: false,
      },
    };
    const players: Player[] = [
      new Player({ id: '1', name: 'Player 1', rating: 1000 }),
      new Player({ id: '2', name: 'Player 2', rating: 1000 }),
      new Player({ id: '3', name: 'Player 3', rating: 1000 }),
      new Player({ id: '4', name: 'Player 4', rating: 1000 }),
    ];
    const pairingSystem = new SwissPairingSystem(tournamentId, config);
    expect(pairingSystem).toBeDefined();
  });
});