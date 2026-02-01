-- Add city column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS city TEXT;

-- Add index for city searches
CREATE INDEX IF NOT EXISTS idx_users_city ON public.users(city);
CREATE INDEX IF NOT EXISTS idx_users_country ON public.users(country);
