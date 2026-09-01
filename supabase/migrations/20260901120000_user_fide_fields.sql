-- Link Parego users to FIDE profiles (looked up via Lichess FIDE API).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS fide_id    INTEGER,
  ADD COLUMN IF NOT EXISTS fide_title TEXT;

CREATE INDEX IF NOT EXISTS idx_users_fide_id ON public.users(fide_id) WHERE fide_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, rating, country, city, fide_id, fide_title)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'rating')::INTEGER, NULL),
    COALESCE(NEW.raw_user_meta_data->>'country', NULL),
    COALESCE(NEW.raw_user_meta_data->>'city', NULL),
    COALESCE((NEW.raw_user_meta_data->>'fide_id')::INTEGER, NULL),
    COALESCE(NEW.raw_user_meta_data->>'fide_title', NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
