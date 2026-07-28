-- Step 1 (Schema): Express interest in a tournament (lightweight, non-binding)
-- Used for discovery: organizers see interest count; joining the pairing pool requires presence.

CREATE TABLE IF NOT EXISTS public.tournament_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

-- Reference tournaments (id is TEXT in this project)
-- No FK to tournaments to avoid hard dependency if table name differs; application enforces validity

COMMENT ON TABLE public.tournament_interest IS 'Users expressing non-binding interest in a tournament; join/pairing requires check-in';

CREATE INDEX IF NOT EXISTS idx_tournament_interest_tournament ON public.tournament_interest(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_interest_user ON public.tournament_interest(user_id);

ALTER TABLE public.tournament_interest ENABLE ROW LEVEL SECURITY;

-- Anyone can read (for interest counts and "who's interested" for organizers)
CREATE POLICY "Anyone can view tournament interest"
  ON public.tournament_interest FOR SELECT
  USING (true);

-- Authenticated users can add their own interest
CREATE POLICY "Users can add own interest"
  ON public.tournament_interest FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their own interest
CREATE POLICY "Users can remove own interest"
  ON public.tournament_interest FOR DELETE
  USING (auth.uid() = user_id);

-- No UPDATE needed (interest is on/off)
