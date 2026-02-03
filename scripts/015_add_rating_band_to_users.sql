-- Onboarding: rating band from fun question (no precise number required)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS rating_band TEXT;

COMMENT ON COLUMN public.users.rating_band IS 'Self-reported strength band: unrated, around_1500, around_2000, over_2000, prefer_not_say';

-- Players: rating for pairing (from profile or onboarding at join)
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS rating INTEGER;

COMMENT ON COLUMN public.players.rating IS 'Player strength for pairing; from profile or onboarding';
