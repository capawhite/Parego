-- Split chess federation (FIDE 3-letter code) from geographic country on user profiles.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS federation TEXT;

CREATE INDEX IF NOT EXISTS idx_users_federation ON public.users(federation);

-- Move obvious FIDE codes out of country (3 uppercase letters). Geographic name backfill
-- happens in app via splitLegacyCountryField on next profile load/save.
UPDATE public.users
SET
  federation = UPPER(TRIM(country)),
  country = NULL
WHERE country IS NOT NULL
  AND TRIM(country) ~ '^[A-Za-z]{3}$';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id, email, name, rating, country, city, federation,
    fide_id, fide_title, fide_standard, fide_rapid, fide_blitz
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'rating')::INTEGER, NULL),
    COALESCE(NEW.raw_user_meta_data->>'country', NULL),
    COALESCE(NEW.raw_user_meta_data->>'city', NULL),
    COALESCE(NEW.raw_user_meta_data->>'federation', NULL),
    COALESCE((NEW.raw_user_meta_data->>'fide_id')::INTEGER, NULL),
    COALESCE(NEW.raw_user_meta_data->>'fide_title', NULL),
    COALESCE((NEW.raw_user_meta_data->>'fide_standard')::INTEGER, NULL),
    COALESCE((NEW.raw_user_meta_data->>'fide_rapid')::INTEGER, NULL),
    COALESCE((NEW.raw_user_meta_data->>'fide_blitz')::INTEGER, NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
