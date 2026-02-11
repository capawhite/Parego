# Guest Identity Implementation

Implementation plan for the guest identity spec: self-entered names, stable internal IDs, per-tournament uniqueness, event-based conversion prompts, and organizer tools.

---

## Phase 1: Per-tournament name uniqueness + collision UX

**Goal:** Unique display names per tournament. Inline disambiguation when collision occurs.

**Acceptance criteria:**
- [x] Join flow rejects duplicate names (case-insensitive) in the same tournament
- [x] Inline error shown: "John already exists in this tournament. Try John R. or John (Madrid)."
- [x] User can edit name and retry (no auto-suffix)
- [x] Same check in arena "Join as self" (registered users) and organizer "Add Guest"

**Files:**
- `app/join/[code]/page.tsx` — check before insert; show error on collision
- `components/arena-panel.tsx` — joinAsSelf and handleAddGuestPlayer
- `lib/database/tournament-db.ts` — add `playerNameExistsInTournament(tournamentId, name)` or similar

**Edge cases:**
- Trimming: compare trimmed, case-insensitive
- Re-joining after removal: allow same name if previous player has left (hasLeft: true)?

---

## Phase 2: Guest identity persistence (repeat-play detection)

**Goal:** Track guest sessions across tournaments so we can say "you've played before."

**Acceptance criteria:**
- [x] localStorage stores guest session history (tournamentId, playerId, displayName, lastPlayedAt)
- [x] On guest join, append to history (cap at last N or 30 days)
- [x] On tournament page load, check for past sessions from this device
- [x] Structure available for Phase 3 prompts

**Files:**
- New: `lib/guest-session-history.ts` — read/write localStorage structure
- `app/join/[code]/page.tsx` — on successful guest join, add to history
- `components/arena-panel.tsx` — on load, check history (for player view)

**localStorage key:** `parego_guest_history`

**Structure:** `Array<{ tournamentId: string; playerId: string; displayName: string; lastPlayedAt: string }>`

---

## Phase 3: Event-based conversion prompts (soft, informational)

**Goal:** Prompt conversion at meaningful moments, not arbitrary counts.

**Triggers:**
1. **Repeat play:** Guest opens tournament page; past guest sessions detected → "You've played here before. Create an account to save your history and ratings."
2. **Result affects rankings:** After submitting match result that changes standings → "This result affects rankings. Create an account to keep your record."
3. **Rated game:** (If applicable) When about to play a rated game → "You're about to play a rated game. Create an account to track your rating."

**Acceptance criteria:**
- [x] Non-blocking modal or toast with "Create account" / "Maybe later"
- [x] Don't spam: remember dismissal (sessionStorage)
- [x] Triggers fire at correct moments

**Files:**
- New: `components/conversion-prompt.tsx` or similar
- `components/arena-panel.tsx` — hook triggers; show prompt
- `app/join/[code]/page.tsx` — optional: prompt after join if repeat play

---

## Phase 4: Claim flow at signup

**Goal:** Let new users reclaim past guest play when registering.

**Acceptance criteria:**
- [x] Signup flow: after location, step "Have you played before?"
- [x] If yes: show recent guest identities from localStorage (tournament + display name)
- [x] User selects which to claim; on account creation, set `user_id` on those player rows
- [x] Server action: `claimGuestHistory(playerIds[])` with auth checks

**Files:**
- `app/auth/signup/page.tsx` — add claim step (step 7)
- New: `app/actions/claim-guest-history.ts`
- New: `scripts/019_claim_guest_players_policy.sql` — RLS policy so users can update guest rows to set `user_id` (run in Supabase after 018)

**Edge cases:**
- Player already has user_id (already claimed) — don't show, or show as "already linked"
- Tournament completed — still allow claim for history

---

## Phase 5: Organizer tools

**Goal:** Rename players; later: merge, flag abuse.

**Rename (Phase 5a):**
- [x] In PlayersList, organizer sees "Rename" for each player
- [x] Server action: `renamePlayer(tournamentId, playerId, newName)` — update `players.name`
- [x] Re-check uniqueness for new name

**Merge (Phase 5b, later):**
- Define merge behavior (which record survives, combine results)
- UI: select two players, confirm merge

**Flag abuse (Phase 5c, later):**
- "Flag" button; create report for manual review

**Files:**
- `components/players-list.tsx` — Rename control
- New: `app/actions/rename-player.ts`

---

## Phase 6: Escalation ladder (future)

**Goal:** Soft → hard conversion over time.

- Informational prompts first
- "History may reset" warning
- Block new tournament joins (never mid-event)
- Persist prompt/escapation state

---

## Implementation order

1. Phase 1 — uniqueness (foundation)
2. Phase 2 — guest history (needed for prompts)
3. Phase 3 — conversion prompts
4. Phase 4 — claim flow
5. Phase 5a — organizer rename
