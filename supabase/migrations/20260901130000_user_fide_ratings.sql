-- Store all three official FIDE ratings (standard, rapid, blitz) per user.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS fide_standard INTEGER,
  ADD COLUMN IF NOT EXISTS fide_rapid    INTEGER,
  ADD COLUMN IF NOT EXISTS fide_blitz    INTEGER;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id, email, name, rating, country, city,
    fide_id, fide_title, fide_standard, fide_rapid, fide_blitz
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'rating')::INTEGER, NULL),
    COALESCE(NEW.raw_user_meta_data->>'country', NULL),
    COALESCE(NEW.raw_user_meta_data->>'city', NULL),
    COALESCE((NEW.raw_user_meta_data->>'fide_id')::INTEGER, NULL),
    COALESCE(NEW.raw_user_meta_data->>'fide_title', NULL),
    COALESCE((NEW.raw_user_meta_data->>'fide_standard')::INTEGER, NULL),
    COALESCE((NEW.raw_user_meta_data->>'fide_rapid')::INTEGER, NULL),
    COALESCE((NEW.raw_user_meta_data->>'fide_blitz')::INTEGER, NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
