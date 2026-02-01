-- Add city and country columns to tournaments table
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add indexes for location searches
CREATE INDEX IF NOT EXISTS idx_tournaments_city ON public.tournaments(city);
CREATE INDEX IF NOT EXISTS idx_tournaments_country ON public.tournaments(country);
CREATE INDEX IF NOT EXISTS idx_tournaments_organizer ON public.tournaments(organizer_id);
