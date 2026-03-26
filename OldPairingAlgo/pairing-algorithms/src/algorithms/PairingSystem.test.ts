import { PairingSystem } from './PairingSystem';

describe('PairingSystem', () => {
  it('should create a PairingSystem', () => {
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
    const pairingSystem = new PairingSystem(tournamentId, config);
    expect(pairingSystem).toBeDefined();
  });
});