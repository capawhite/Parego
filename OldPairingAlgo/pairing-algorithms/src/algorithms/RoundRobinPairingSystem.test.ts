import { RoundRobinPairingSystem } from './RoundRobinPairingSystem';
import { Player } from '../models/Player';

describe('RoundRobinPairingSystem', () => {
  it('should create a RoundRobinPairingSystem', () => {
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
    ];
    const pairingSystem = new RoundRobinPairingSystem(tournamentId, config);
    players.forEach(player => pairingSystem.addPlayer(player));
    expect(pairingSystem).toBeDefined();
  });
});