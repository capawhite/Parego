-- Add latitude, longitude, visibility, and start_time to tournaments table
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private'));
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;

-- Add spatial index for geo queries (using btree since PostGIS may not be available)
CREATE INDEX IF NOT EXISTS idx_tournaments_lat ON public.tournaments(latitude);
CREATE INDEX IF NOT EXISTS idx_tournaments_lon ON public.tournaments(longitude);
CREATE INDEX IF NOT EXISTS idx_tournaments_visibility ON public.tournaments(visibility);
CREATE INDEX IF NOT EXISTS idx_tournaments_start_time ON public.tournaments(start_time);

-- Composite index for nearby queries: public tournaments with geo data
CREATE INDEX IF NOT EXISTS idx_tournaments_nearby 
ON public.tournaments(visibility, status, latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
