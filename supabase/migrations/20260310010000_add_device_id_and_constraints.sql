-- Add device_id column for one-join-per-device guest enforcement
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Partial unique index: one guest join per device per tournament
-- NULL device_id (organizer-added players) is excluded
CREATE UNIQUE INDEX IF NOT EXISTS players_tournament_device_unique
  ON public.players (tournament_id, device_id)
  WHERE device_id IS NOT NULL;

-- Partial unique index: one registered user per tournament
CREATE UNIQUE INDEX IF NOT EXISTS players_tournament_user_unique
  ON public.players (tournament_id, user_id)
  WHERE user_id IS NOT NULL;
