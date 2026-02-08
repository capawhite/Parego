# Database migrations

Run SQL in order. Apply in Supabase: **SQL Editor** or `psql` against your project.

## Order

1. `001_create_users_table.sql` through `011_matches_rls_policies.sql` (existing)
2. **Step 1 (redesign):**
   - `012_add_presence_to_players.sql` — `checked_in_at`, `presence_source` on `players`
   - `013_add_tournament_interest.sql` — new table `tournament_interest` + RLS
   - `014_add_profile_presence_and_interest.sql` — `avatar_url`, `personality_answer` on `users`; `presence_radius_m` on `tournaments`
   - **Storage (avatars):** See **`docs/AVATAR_STORAGE_SETUP.md`** — create bucket `avatars` in Dashboard, then run `016_storage_avatars_bucket.sql` for RLS policies.
   - `017_check_email_available.sql` — RPC for email availability check (signup)
   - `018_anyone_can_add_players.sql` — RLS policy allowing anyone to insert into `players` (required for join flow)

## Step 1 schema summary

| Where | What |
|-------|------|
| **players** | `checked_in_at` (timestamptz), `presence_source` ('gps' \| 'qr' \| 'override') |
| **tournament_interest** | New table: `tournament_id`, `user_id`, `created_at`; RLS for select (all), insert/delete (own) |
| **users** | `avatar_url` (text), `personality_answer` (text) |
| **tournaments** | `presence_radius_m` (integer, optional; null = use app default e.g. 150) |

After running, the app types and `tournament-db` load/save already handle presence on players and `presence_radius_m` on tournaments.
