# Local Pairing Algorithms

This directory contains the local copy of the tournament pairing algorithms, originally from `github.com/capawhite/PairingAlgo`.

## What's Included

This is a comprehensive tournament management system with sophisticated pairing algorithms supporting:

- **Arena Tournaments**: Players can join and leave at any time
- **Swiss Tournaments**: Fixed number of rounds with score-based pairing
- **Round Robin**: Each player plays every other player
- **Elimination**: Single/double elimination brackets

## Key Features

- Advanced pairing algorithms with configurable parameters
- Sophisticated tie-break systems (Buchholz, Sonneborn-Berger, etc.)
- Color balancing for fair piece distribution
- Team-aware pairing to avoid same-team matches
- Performance rating calculations
- Comprehensive visualization tools

## API Overview

```typescript
import {
  Tournament,
  Player,
  PairingSystem,
  SwissPairingSystem,
  EliminationPairingSystem,
  RoundRobinPairingSystem
} from './pairing-algorithms';

// Create a tournament
const tournament = new Tournament({
  id: 'tournament-1',
  name: 'My Tournament',
  type: 'arena'
});

// Add players
const player1 = new Player({ id: 'p1', name: 'Alice', rating: 1500 });
const player2 = new Player({ id: 'p2', name: 'Bob', rating: 1600 });
tournament.addPlayer(player1);
tournament.addPlayer(player2);

// Generate pairings
const pairings = tournament.generatePairings();
```

## Integration Options

### Option 1: Keep as TypeScript Service
- Run as a separate Node.js service on port 8081
- Go server makes HTTP calls to get pairings
- Current implementation in `pairing-service/`

### Option 2: Direct Go Integration
- Port the algorithms to Go
- Integrate directly into the Go server
- Better performance, no network calls

### Option 3: Hybrid Approach
- Use TypeScript service for complex algorithms
- Simple algorithms implemented directly in Go
- Current approach with fallback

## Current Status

✅ **Algorithms copied locally**
✅ **Package.json created**
✅ **Server integration ready**
✅ **Fallback simple pairing working**

## Next Steps

1. **Test the algorithms**: Run the existing test files
2. **Choose integration method**: Decide between service calls vs direct integration
3. **Update server**: Replace simple pairing with sophisticated algorithms
4. **Add tournament lifecycle**: Implement start/stop/status management

## Running Tests

```bash
cd pairing-algorithms
npm install
npm test
```

## Examples

Check the `examples/` directory for usage examples and the `tests/` directory for comprehensive test cases.
