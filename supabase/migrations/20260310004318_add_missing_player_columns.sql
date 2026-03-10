-- Add missing player columns that exist in app code but were absent from production DB.
-- Discovered via simulation script: insertPlayer() references these columns.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS is_paused  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_removed BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.players.is_paused  IS 'Player is currently paused from the pairing pool';
COMMENT ON COLUMN public.players.is_removed IS 'Player was removed from the tournament mid-play';
