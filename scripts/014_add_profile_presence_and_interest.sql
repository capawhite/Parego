-- Step 1 (Schema): Profile extensions for onboarding (avatar, fun question)
-- Optional presence radius per tournament (default 150m); app can override with a constant if preferred.

-- User profile: avatar URL (Supabase Storage or external)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Fun chess personality/skill question answer (store option key or short text)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS personality_answer TEXT;

COMMENT ON COLUMN public.users.avatar_url IS 'Optional profile/avatar image URL (e.g. Supabase Storage)';
COMMENT ON COLUMN public.users.personality_answer IS 'Optional onboarding: answer to fun chess personality/skill question';

-- Tournament-level presence radius in meters (optional; NULL = use app default e.g. 150)
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS presence_radius_m INTEGER;

COMMENT ON COLUMN public.tournaments.presence_radius_m IS 'GPS check-in radius in meters; NULL = use app default (e.g. 150)';

CREATE INDEX IF NOT EXISTS idx_tournaments_presence_radius ON public.tournaments(presence_radius_m)
  WHERE presence_radius_m IS NOT NULL;
