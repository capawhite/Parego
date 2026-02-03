-- Step 1 (Schema): Presence verification for OTB tournaments
-- Players must check in at the venue (GPS or later QR/override) to enter the pairing pool.

-- When the player was verified as present at the venue (NULL = not checked in)
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;

-- How presence was verified: 'gps' | 'qr' | 'override' (extensible for future methods)
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS presence_source TEXT
  CHECK (presence_source IS NULL OR presence_source IN ('gps', 'qr', 'override'));

COMMENT ON COLUMN public.players.checked_in_at IS 'When the player checked in at the venue; NULL means not yet present';
COMMENT ON COLUMN public.players.presence_source IS 'How presence was verified: gps, qr, or organizer override';

CREATE INDEX IF NOT EXISTS idx_players_checked_in_at ON public.players(checked_in_at)
  WHERE checked_in_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_players_tournament_checked_in ON public.players(tournament_id, checked_in_at)
  WHERE checked_in_at IS NOT NULL;
