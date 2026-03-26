---
name: Result countdown and all-play-all pairing
overview: Remove the result-submission countdown and replace it with immediate submit plus clear "waiting for opponent" copy; fix all-vs-all pairing so the same two players are not re-paired immediately by using opponent history and round-based pairing.
todos: []
isProject: false
---

# Result countdown removal and all-play-all pairing fixes

## 1. Result submission: remove countdown, submit immediately, update copy

**Current behavior**  
In [components/match-result-submitter.tsx](components/match-result-submitter.tsx), when a player selects a result (e.g. "White wins"):

- `onSubmit(result)` stores the choice in parent state.
- A 10s countdown runs; when it hits 0 or the user clicks "Confirm now", `onConfirm()` is called and the parent sends the result to the API.

You reported the countdown "stays put at 10s" (likely effect re-running or stale state). The original intent of the countdown was a short "confirm your choice" delay, but it adds complexity and you want it gone.

**Planned changes**

- **Remove countdown and Confirm now/Cancel**  
Delete countdown state, the `useEffect` that starts the timer, the "Confirming in Xs" UI, the "Confirm now" button, and the "Cancel (Change my mind)" button.
- **Submit as soon as a result is chosen**  
In `handleSelect(result)`:
  - Call `onSubmit(result)` (keeps parent state in sync).
  - Call `onConfirm()` immediately so the API request runs without delay.
- **Update waiting copy**  
When the player has submitted and we’re waiting for the opponent, replace the current "Waiting for opponent to confirm..." with:
  - **"Waiting for opponent to submit result. If they don't, you can report your score to the tournament organizer."**
- **Optional: allow changing result before opponent submits**  
If we want to support "change my mind" before the opponent has submitted, we could keep the three result buttons enabled until the opponent submits, and have the parent support "clearing" a submission (e.g. a "Change my result" action that calls an `onCancel` and clears the stored submission so the player can re-select and submit again). The plan assumes we do **not** add this for now; we can add it in a follow-up if you want.

**Files**

- [components/match-result-submitter.tsx](components/match-result-submitter.tsx): remove countdown/effect/ref, call `onConfirm()` in `handleSelect`, update Alert copy.

---

## 2. All-play-all: stop immediate re-pairing of the same two players

**What you’re seeing**  
With 4 players and "all play all", when a game ends the same two players are paired again almost immediately instead of waiting for the other game to finish so that better (different) pairings can be made.

**Root causes**

1. **Rematch logic never runs**
  [lib/pairing/all-vs-all.ts](lib/pairing/all-vs-all.ts) builds "recent opponents" and "rematch" penalties from `player.history` (lines 73–96). The [Player](lib/types.ts) type has no `history`; it has `opponentIds: string[]` and `gameResults: ("W"|"D"|"L")[]`. So `player.history` is always undefined, the maps stay empty, and every pair is treated as `rematchLevel === "none"`.
2. **Pairing runs as soon as two players are free**
  [shouldPair](lib/pairing/all-vs-all.ts) (lines 124–137) only requires:
  - `availablePlayers.length >= dynamicThreshold` (e.g. 2 for 4 players)
  - `availableTables > 0`  
   So the moment two players finish, they are the only two available and get paired again; there is no "wait for the rest of the round."

**Planned changes**

**A. Use real player history in all-vs-all**

- In [lib/pairing/all-vs-all.ts](lib/pairing/all-vs-all.ts), replace the `player.history`-based loop with logic that builds the same structures (`allOpponents`, `recentOpponents`, `veryRecentOpponents`) from `player.opponentIds` and `player.gameResults`.
- Treat `opponentIds[i]` as the opponent in game `i`, with "games ago" = `opponentIds.length - i` (most recent = index `length-1`). Populate the three maps so that:
  - "Very recent" = last 3 games
  - "Recent" = last 10 games
  - "All" = all opponents
- No change to the rest of the scoring or filtering; the existing rematch penalties will then apply when there are multiple pairing options.

**B. Round-based pairing for all-vs-all**

- In [lib/pairing/all-vs-all.ts](lib/pairing/all-vs-all.ts), tighten `shouldPair` for all-vs-all so that we only create new pairings when **no games are in progress** (i.e. the "round" is over):
  - Add a condition: `activeMatches.length === 0`.
- Effect: when one game finishes, those two players become "available" but we do not pair until the other game(s) finish. When all active matches are done, `availablePlayers` can be 4 (or more), and `createPairings` will produce 2 new matches that prefer non-rematches (once history is fixed).
- Optional: pass `activeMatches.length` into `shouldPair` (it already receives `activeMatches`); the algorithm can use it. So the change is inside `shouldPair`: return false if `activeMatches.length > 0` for all-vs-all.

**Files**

- [lib/pairing/all-vs-all.ts](lib/pairing/all-vs-all.ts):
  - Build opponent/history data from `opponentIds` (and optionally `gameResults`) instead of `player.history`.
  - In `shouldPair`, for this algorithm only: require `activeMatches.length === 0` so pairing only runs when the round is complete.

**Result**

- Countdown is removed; result is sent as soon as the player picks an outcome; they see the new "waiting for opponent / report to organizer" message.
- All-vs-all uses real opponent history for rematch penalties and only pairs when there are no active matches, so the same two players are not re-paired immediately and rounds can complete before the next set of pairings.

