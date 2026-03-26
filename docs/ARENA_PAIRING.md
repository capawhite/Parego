# Arena pairing (ARENACHESS + Parego)

Primary design reference: [ARENACHESS.docx.pdf](./ARENACHESS.docx.pdf) (Spanish spec).

## Triggers (when new games may be created)

1. **Polling** — The arena UI runs the pairing algorithm on an interval (`getPollingInterval`, e.g. 2s for Arena).
2. **Min idle players** — `minIdlePlayersBeforePairing` (default `max(4, floor(n/4))`, capped by field size) must be met among **T1-eligible** idle players for Arena.
3. **Arena only: T1 eligibility** — Players who are **idle** (no active game) but still inside the post-game **T1** freeze are **not** counted toward that minimum and are **excluded** from pairing. They can still appear “free” in the UI until the next game is assigned. While **any** games are still in progress, the required count is **`min(defaultThreshold, max(2, idleCount))`** so the engine does not wait for more free players than actually exist (you can get new boards while other games finish).
4. **History passed to pairing** — `allTimeMatches` is merged with any **completed** matches still listed in `pairedMatches` (so T1 always sees finished games after a reload or All vs All–style state).
5. **Small fields** — Default min idle is **capped at `totalPlayers`**, so a 2–3 player tournament is not required to reach 4 T1-eligible players before pairing.
6. **Free tables** — At least one table without an active game. Slot count uses `max(arena.tableCount, settings.tableCount, 1)` so pairing is not blocked when the DB `tables_count` column is still 0 but settings were saved with a positive `tableCount` (see [`lib/tournament/effective-table-count.ts`](../lib/tournament/effective-table-count.ts)).

**All vs All** uses the same polling; it does **not** apply Arena T1 (sixth argument to `shouldPair` is ignored there).

## T1 and T2 (PDF)

- **T1** — “Tiempo congelado antes de emparejar.” Computed from time control **Tp**, last game duration **Dp**, and whether the last result was a draw (see [`lib/pairing/arena-t1.ts`](../lib/pairing/arena-t1.ts)). Eligible time for pairing: `effectiveMatchEnd + T1`.
- **T2** — Interval to widen the table band **Mo ± P**. The wait clock for T2 starts when the player becomes **T1-eligible**. The raw PDF formula can imply multi-minute steps with long clocks; Parego **clamps each player’s T2 step** to roughly **8–35 seconds** so bands overlap in practice. If the banded pass still produces no games, a **fallback pass** puts every eligible player on **all tables 1..M** and pairs again (strength bands are relaxed before deadlock).

## Game-count fairness (Arena)

Within each table’s queue, sort prefers **fewer games played**, then **longer wait**. When choosing among valid oriented pairs, tie-breaks also prefer **lower peak games** in the pair and **higher “deficit”** vs the field average (players below average get priority).

## Related files

| Area | File |
|------|------|
| T1 math + eligibility | `lib/pairing/arena-t1.ts` |
| Arena tables / Mo / T2 / pairing loop | `lib/pairing/balanced-strength.ts` |
| Idle threshold default | `lib/pairing/idle-threshold.ts` |
| Longest-idle ties (color cap relaxation) | `lib/pairing/idle-wait.ts` |
| Pairing tick | `components/arena-panel.tsx` |
| Algorithm interface | `lib/pairing/types.ts` |
| Load match timestamps for T1 | `lib/database/tournament-db.ts` (`loadMatches`) |

## Intentional differences from the PDF

- **Colors** — Parego uses cost-based orientation plus a consecutive same-color cap (strict → relaxed → none), not the PDF’s step-by-step historical walk.
- **T3** (courtesy time to reach the board) — not modeled in code.
- **Online scale** — No Lichess-style global min-cost matching; pairing stays table-list based per ARENACHESS.
