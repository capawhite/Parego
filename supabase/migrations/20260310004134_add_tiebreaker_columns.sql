-- Add tiebreaker scoring columns to players table.
-- These are referenced by insertPlayer() and savePlayers() in lib/database/tournament-db.ts
-- but were missing from the production database, causing player join failures.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS buchholz        NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sonneborn_berger NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.players.buchholz         IS 'Buchholz tiebreaker score (sum of opponents'' scores)';
COMMENT ON COLUMN public.players.sonneborn_berger IS 'Sonneborn-Berger tiebreaker score (sum of defeated opponents'' scores)';
