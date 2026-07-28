# Legacy SQL scripts — DO NOT RUN

> **⚠️ These scripts are superseded and archived. Never apply them to any environment.**

The canonical database schema lives in **`supabase/migrations/`**. The baseline migration
(`20260310000000_baseline_schema.sql`) consolidates everything these scripts did, and later
migrations (`20260728120000_rls_join_hardening.sql`, `20260728130000_pairing_lease.sql`,
`20260728180000_security_sprint.sql`) intentionally **replace or drop** policies that these
scripts create.

Running these would undo security hardening. In particular:

- `018_anyone_can_add_players.sql` — recreates the open guest INSERT policy that was removed;
  guest joins now go through the service-role `joinTournamentAction`.
- `019_claim_guest_players_policy.sql` — recreates the open guest-claim UPDATE policy that was
  dropped; claims now go through the admin-validated `claimGuestHistoryForDevice` action with
  `device_id` proof.
- `009`–`011` RLS scripts — recreate baseline policies that later migrations tightened.

They are kept only as historical reference for how the schema evolved before the baseline
migration existed.

## Applying the real schema

Use the files in `supabase/migrations/` in timestamp order, via the Supabase SQL Editor or
`npx supabase db push`.
