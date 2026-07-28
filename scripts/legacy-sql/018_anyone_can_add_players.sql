-- Allow anyone (including guests) to add themselves as players to a tournament.
-- Required for the join flow: both registered users and guests use the join page
-- which inserts directly into players via the Supabase client.
-- Run this after 010_players_rls_policies.sql if setting up a fresh Supabase project.

DROP POLICY IF EXISTS "Anyone can add players" ON players;
CREATE POLICY "Anyone can add players"
ON players FOR INSERT
WITH CHECK (true);
