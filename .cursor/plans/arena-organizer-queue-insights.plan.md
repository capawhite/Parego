---
name: ""
overview: ""
todos: []
isProject: false
---

# Arena organizer: pairing queue and wait visibility

## Goal

Show organizers **why pairing is not happening** and **who is waiting how long**, without changing pairing rules (unless later decided).

## Data to surface (organizer-only)

Computed from current `ArenaState` + `Date.now()` using existing helpers in `[lib/pairing/arena-t1.ts](lib/pairing/arena-t1.ts)`, `[lib/pairing/idle-threshold.ts](lib/pairing/idle-threshold.ts)`, and mirroring gates in `[lib/pairing/balanced-strength.ts](lib/pairing/balanced-strength.ts)` / `[lib/pairing/all-vs-all.ts](lib/pairing/all-vs-all.ts)`.

1. **Idle vs in-game**
  - Count in active (incomplete) games vs **idle** (not paused, checked-in if venue, not in an active pairing).
2. **Arena (`balanced-strength`) — T1 column**
  - For each idle player: `eligibleAt = arenaPairingEligibleAtMs(player, historyMatches, settings)` and **remaining ms** = `max(0, eligibleAt - now)` (if `eligibleAt === 0` treat as eligible now for display).
  - Split into:
    - **Ready to pair** (T1-eligible idlers)
    - **In T1 freeze** (idle but not yet eligible), show **countdown** or “ready at …” time.
3. **Gating summary** (why `shouldPair` is false or `createPairings` returns empty)
  - **Small field (≤4):** “No new pairings while any game is in progress” when rule applies.
  - **Min idle:** show configured/default threshold vs **T1-eligible idle count** (Arena) or **raw idle count** (All vs All).
  - **While games active (Arena):** show **effective** threshold = `min(threshold, max(2, availablePlayers.length))` so organizers see the relaxation.
  - **Tables:** `availableTables` / total slots from `[effectiveTableSlotsForPairing](lib/tournament/effective-table-count.ts)`.
  - **Stabilization:** if `pairingStabilizationMs` set, show “conditions must hold for X ms” and optionally time satisfied so far (requires same ref/timer pattern as pairing effect or a lightweight duplicate timer in UI).
4. **Extra useful rows**
  - Paused / not checked-in (venue) players: **excluded from idle** — list count so it is not confused with “missing players.”
  - **Tp** (estimated max game ms) from settings — helps explain why T1 caps feel long.
  - Optional: **last completed match end + T1** tooltip per player (advanced).

## UI placement (suggestions)

- **Primary:** collapsible **“Pairing status”** or **“Queue”** panel on the **Pairings** tab (or below header stats) — `isOrganizer` only.
- **Secondary:** single line in `[arena-tournament-header.tsx](components/tournament/arena-tournament-header.tsx)` when organizer: e.g. “3 ready · 2 in T1 (~2m)” with click to expand.

## Implementation sketch

1. Add `lib/pairing/arena-pairing-insights.ts` (or `hooks/use-arena-pairing-insights.ts`) that takes `ArenaState`, `tournamentMetadata` (venue), `nowMs`, returns a typed snapshot (no React in lib if pure).
2. Reuse the same `matchesForPairing` merge as `[components/arena-panel.tsx](components/arena-panel.tsx)` (allTime + completed in paired) for history.
3. New component `ArenaPairingStatusPanel` consumed from `arena-panel.tsx` with props from the hook/pure function.
4. **i18n:** add keys under `arena.`* in `[localization/messages.en.json](localization/messages.en.json)` and `[localization/messages.es.json](localization/messages.es.json)`.

## Algorithm-specific notes

- **All vs All:** no T1; show only idle counts, small-field rule, min idle, tables, stabilization.
- **Arena:** full T1 breakdown.

## Out of scope (later)

- Changing T1 formula (separate product decision).
- Server-side pairing; this panel is client truth same as current pairing loop.

