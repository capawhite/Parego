-- =============================================================
-- Organizer follows + clubs (owned orgs with staff-only events)
-- Replaces empty legacy clubs / club_members prototypes if present.
-- =============================================================

-- ── Organizer follows ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizer_follows (
  follower_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organizer_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, organizer_id),
  CONSTRAINT organizer_follows_no_self CHECK (follower_id <> organizer_id)
);

CREATE INDEX IF NOT EXISTS idx_organizer_follows_organizer
  ON public.organizer_follows(organizer_id);
CREATE INDEX IF NOT EXISTS idx_organizer_follows_follower
  ON public.organizer_follows(follower_id);

ALTER TABLE public.organizer_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view organizer follows" ON public.organizer_follows;
CREATE POLICY "Anyone can view organizer follows"
  ON public.organizer_follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can follow organizers" ON public.organizer_follows;
CREATE POLICY "Users can follow organizers"
  ON public.organizer_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can unfollow organizers" ON public.organizer_follows;
CREATE POLICY "Users can unfollow organizers"
  ON public.organizer_follows FOR DELETE
  USING (auth.uid() = follower_id);

-- ── Replace legacy clubs schema (prototype: no slug / city) ──
-- Safe: live prototype tables are unused (0 rows) and club_id on
-- tournaments was unbound text. Drop + recreate to match app model.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clubs' AND column_name = 'owner_id'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clubs' AND column_name = 'invite_code'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clubs' AND column_name = 'slug'
  ) THEN
    -- Drop FK from tournaments.club_id if present, then drop legacy tables
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name = 'club_id'
    ) THEN
      ALTER TABLE public.tournaments DROP COLUMN club_id;
    END IF;

    DROP TABLE IF EXISTS public.club_follows CASCADE;
    DROP TABLE IF EXISTS public.club_members CASCADE;
    DROP TABLE IF EXISTS public.clubs CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.clubs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT,
  city         TEXT,
  country      TEXT,
  latitude     DOUBLE PRECISION,
  longitude    DOUBLE PRECISION,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT clubs_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 2 AND 48)
);

CREATE INDEX IF NOT EXISTS idx_clubs_name ON public.clubs(name);
CREATE INDEX IF NOT EXISTS idx_clubs_city ON public.clubs(city);
CREATE INDEX IF NOT EXISTS idx_clubs_location ON public.clubs(latitude, longitude);

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view clubs" ON public.clubs;
DROP POLICY IF EXISTS "Anyone can view public clubs" ON public.clubs;
DROP POLICY IF EXISTS "Owners can view own clubs" ON public.clubs;
CREATE POLICY "Anyone can view clubs"
  ON public.clubs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create clubs" ON public.clubs;
CREATE POLICY "Authenticated users can create clubs"
  ON public.clubs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

DROP POLICY IF EXISTS "Owner can update club" ON public.clubs;
DROP POLICY IF EXISTS "Owner can delete club" ON public.clubs;

-- ── Club members ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_members (
  club_id     UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (club_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_members_user ON public.club_members(user_id);
CREATE INDEX IF NOT EXISTS idx_club_members_club_role ON public.club_members(club_id, role);

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view club members" ON public.club_members;
CREATE POLICY "Anyone can view club members"
  ON public.club_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owners can manage members" ON public.club_members;
DROP POLICY IF EXISTS "Users can join clubs" ON public.club_members;
DROP POLICY IF EXISTS "Users can leave clubs" ON public.club_members;

CREATE OR REPLACE FUNCTION public.is_club_staff(p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_members m
    WHERE m.club_id = p_club_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_club_owner(p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_members m
    WHERE m.club_id = p_club_id
      AND m.user_id = auth.uid()
      AND m.role = 'owner'
  );
$$;

REVOKE ALL ON FUNCTION public.is_club_staff(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_club_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_club_staff(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_club_owner(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Club staff can update clubs" ON public.clubs;
CREATE POLICY "Club staff can update clubs"
  ON public.clubs FOR UPDATE
  USING (public.is_club_staff(id))
  WITH CHECK (public.is_club_staff(id));

DROP POLICY IF EXISTS "Club owners can manage members" ON public.club_members;
CREATE POLICY "Club owners can manage members"
  ON public.club_members FOR ALL
  USING (public.is_club_owner(club_id))
  WITH CHECK (public.is_club_owner(club_id));

-- Creator becomes owner (bypass membership policy via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.handle_new_club()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.club_members (club_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_club_created ON public.clubs;
CREATE TRIGGER on_club_created
  AFTER INSERT ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_club();

-- ── Club follows ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_follows (
  follower_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id      UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, club_id)
);

CREATE INDEX IF NOT EXISTS idx_club_follows_club ON public.club_follows(club_id);
CREATE INDEX IF NOT EXISTS idx_club_follows_follower ON public.club_follows(follower_id);

ALTER TABLE public.club_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view club follows" ON public.club_follows;
CREATE POLICY "Anyone can view club follows"
  ON public.club_follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can follow clubs" ON public.club_follows;
CREATE POLICY "Users can follow clubs"
  ON public.club_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can unfollow clubs" ON public.club_follows;
CREATE POLICY "Users can unfollow clubs"
  ON public.club_follows FOR DELETE
  USING (auth.uid() = follower_id);

-- ── Tournament ↔ club ────────────────────────────────────────
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL;

-- If a prior text club_id somehow remained without being dropped, coerce via recreate.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tournaments'
      AND column_name = 'club_id'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE public.tournaments DROP COLUMN club_id;
    ALTER TABLE public.tournaments
      ADD COLUMN club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tournaments_club ON public.tournaments(club_id);

-- Staff-only assignment of club_id on insert/update
CREATE OR REPLACE FUNCTION public.enforce_club_tournament_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.club_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in required to create a club tournament';
  END IF;
  IF NOT public.is_club_staff(NEW.club_id) THEN
    RAISE EXCEPTION 'Only club owners or admins can create tournaments for this club';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tournaments_enforce_club_staff ON public.tournaments;
CREATE TRIGGER tournaments_enforce_club_staff
  BEFORE INSERT OR UPDATE OF club_id ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_club_tournament_staff();
