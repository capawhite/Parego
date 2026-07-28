-- Swiss (FIDE-style) pairing: round index, bye matches, player bye eligibility

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS swiss_round INTEGER,
  ADD COLUMN IF NOT EXISTS match_kind TEXT DEFAULT 'play'
    CHECK (match_kind IS NULL OR match_kind IN ('play', 'pairing-bye'));

COMMENT ON COLUMN public.matches.swiss_round IS '1-based Swiss round when using fide-swiss algorithm';
COMMENT ON COLUMN public.matches.match_kind IS 'play = normal game; pairing-bye = pairing-allocated bye';

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS received_pairing_bye BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS received_forfeit_win BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.players.received_pairing_bye IS 'Already received a pairing-allocated bye this event';
COMMENT ON COLUMN public.players.received_forfeit_win IS 'Already had forfeit win; ineligible for pairing bye';
