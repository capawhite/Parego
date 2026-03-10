-- =============================================================
-- Parego — Baseline schema migration
-- Consolidated from scripts/001 – scripts/019 which were applied
-- manually before migration tracking was set up.
-- =============================================================

-- ──────────────────────────────────────────────────────────────
-- USERS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id                  UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT,
  name                TEXT          NOT NULL,
  rating              INTEGER,
  rating_band         TEXT,
  country             TEXT,
  city                TEXT,
  clubs               TEXT[],
  latitude            DOUBLE PRECISION,
  longitude           DOUBLE PRECISION,
  avatar_url          TEXT,
  personality_answer  TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all profiles"          ON public.users;
DROP POLICY IF EXISTS "Allow profile creation during signup" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile"        ON public.users;

CREATE POLICY "Users can view all profiles"
  ON public.users FOR SELECT USING (true);

CREATE POLICY "Allow profile creation during signup"
  ON public.users FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE INDEX IF NOT EXISTS idx_users_email    ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_name     ON public.users(name);
CREATE INDEX IF NOT EXISTS idx_users_city     ON public.users(city);
CREATE INDEX IF NOT EXISTS idx_users_country  ON public.users(country);
CREATE INDEX IF NOT EXISTS users_location_idx ON public.users(latitude, longitude);

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, rating, country, city)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'rating')::INTEGER, NULL),
    COALESCE(NEW.raw_user_meta_data->>'country', NULL),
    COALESCE(NEW.raw_user_meta_data->>'city', NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Check email availability (callable by anon for signup validation)
CREATE OR REPLACE FUNCTION public.check_email_available(p_email text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE email IS NOT NULL
      AND LOWER(TRIM(email)) = LOWER(TRIM(NULLIF(p_email, '')))
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_email_available(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_email_available(text) TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- TOURNAMENTS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournaments (
  id                TEXT          PRIMARY KEY,
  name              TEXT          NOT NULL,
  status            TEXT          NOT NULL DEFAULT 'setup'
                                  CHECK (status IN ('setup', 'active', 'completed')),
  tables_count      INTEGER       NOT NULL DEFAULT 0,
  settings          JSONB,
  city              TEXT,
  country           TEXT,
  organizer_id      UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_id          UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  latitude          DOUBLE PRECISION,
  longitude         DOUBLE PRECISION,
  visibility        TEXT          DEFAULT 'public'
                                  CHECK (visibility IN ('public', 'private')),
  start_time        TIMESTAMPTZ,
  presence_radius_m INTEGER,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active tournaments"       ON public.tournaments;
DROP POLICY IF EXISTS "Organizers can manage their tournaments"  ON public.tournaments;
DROP POLICY IF EXISTS "Authenticated users can create tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Organizers can delete their tournaments"  ON public.tournaments;

CREATE POLICY "Anyone can view active tournaments"
  ON public.tournaments FOR SELECT USING (true);

CREATE POLICY "Organizers can manage their tournaments"
  ON public.tournaments FOR UPDATE
  USING  (auth.uid() = organizer_id OR auth.uid() = owner_id)
  WITH CHECK (auth.uid() = organizer_id OR auth.uid() = owner_id);

CREATE POLICY "Authenticated users can create tournaments"
  ON public.tournaments FOR INSERT
  WITH CHECK (auth.uid() = organizer_id OR auth.uid() = owner_id);

CREATE POLICY "Organizers can delete their tournaments"
  ON public.tournaments FOR DELETE
  USING (auth.uid() = organizer_id OR auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_tournaments_city             ON public.tournaments(city);
CREATE INDEX IF NOT EXISTS idx_tournaments_country          ON public.tournaments(country);
CREATE INDEX IF NOT EXISTS idx_tournaments_organizer        ON public.tournaments(organizer_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_lat              ON public.tournaments(latitude);
CREATE INDEX IF NOT EXISTS idx_tournaments_lon              ON public.tournaments(longitude);
CREATE INDEX IF NOT EXISTS idx_tournaments_visibility       ON public.tournaments(visibility);
CREATE INDEX IF NOT EXISTS idx_tournaments_start_time       ON public.tournaments(start_time);
CREATE INDEX IF NOT EXISTS idx_tournaments_nearby
  ON public.tournaments(visibility, status, latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tournaments_presence_radius
  ON public.tournaments(presence_radius_m)
  WHERE presence_radius_m IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- PLAYERS
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.players (
  id                 TEXT          PRIMARY KEY,
  tournament_id      TEXT          NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name               TEXT          NOT NULL,
  user_id            UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  is_guest           BOOLEAN       DEFAULT false,
  points             NUMERIC       DEFAULT 0,
  wins               INTEGER       DEFAULT 0,
  draws              INTEGER       DEFAULT 0,
  losses             INTEGER       DEFAULT 0,
  games_played       INTEGER       DEFAULT 0,
  white_count        INTEGER       DEFAULT 0,
  black_count        INTEGER       DEFAULT 0,
  current_streak     INTEGER       DEFAULT 0,
  on_streak          BOOLEAN       DEFAULT false,
  paused             BOOLEAN       DEFAULT false,
  is_paused          BOOLEAN       DEFAULT false,
  is_removed         BOOLEAN       DEFAULT false,
  game_history       JSONB         DEFAULT '[]',
  opponents          JSONB         DEFAULT '[]',
  results            JSONB         DEFAULT '[]',
  colors             JSONB         DEFAULT '[]',
  points_earned      JSONB         DEFAULT '[]',
  table_numbers      JSONB         DEFAULT '[]',
  checked_in_at      TIMESTAMPTZ,
  presence_source    TEXT          CHECK (presence_source IS NULL OR
                                         presence_source IN ('gps', 'qr', 'override')),
  rating             INTEGER,
  buchholz           NUMERIC       DEFAULT 0,
  sonneborn_berger   NUMERIC       DEFAULT 0,
  country            TEXT,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view tournament players"      ON public.players;
DROP POLICY IF EXISTS "Anyone can add players"                  ON public.players;
DROP POLICY IF EXISTS "Organizers can manage tournament players" ON public.players;
DROP POLICY IF EXISTS "Users can claim guest player rows"       ON public.players;
DROP POLICY IF EXISTS "Organizers can delete players"          ON public.players;

CREATE POLICY "Anyone can view tournament players"
  ON public.players FOR SELECT USING (true);

CREATE POLICY "Anyone can add players"
  ON public.players FOR INSERT WITH CHECK (true);

CREATE POLICY "Organizers can manage tournament players"
  ON public.players FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments
      WHERE tournaments.id = players.tournament_id
        AND (tournaments.organizer_id = auth.uid() OR tournaments.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments
      WHERE tournaments.id = players.tournament_id
        AND (tournaments.organizer_id = auth.uid() OR tournaments.owner_id = auth.uid())
    )
  );

CREATE POLICY "Users can claim guest player rows"
  ON public.players FOR UPDATE
  USING  (user_id IS NULL)
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Organizers can delete players"
  ON public.players FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments
      WHERE tournaments.id = players.tournament_id
        AND (tournaments.organizer_id = auth.uid() OR tournaments.owner_id = auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS idx_players_user_id             ON public.players(user_id);
CREATE INDEX IF NOT EXISTS idx_players_tournament_id       ON public.players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_players_checked_in_at
  ON public.players(checked_in_at) WHERE checked_in_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_tournament_checked_in
  ON public.players(tournament_id, checked_in_at) WHERE checked_in_at IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- MATCHES
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.matches (
  id                      TEXT        PRIMARY KEY,
  tournament_id           TEXT        NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player1_id              TEXT        NOT NULL,
  player2_id              TEXT        NOT NULL,
  player1_data            TEXT,
  player2_data            TEXT,
  table_number            INTEGER,
  result                  TEXT,
  completed               BOOLEAN     DEFAULT false,
  completed_at            TIMESTAMPTZ,
  player1_submission      TEXT        CHECK (player1_submission IS NULL OR
                                             player1_submission IN ('player1-win', 'draw', 'player2-win')),
  player2_submission      TEXT        CHECK (player2_submission IS NULL OR
                                             player2_submission IN ('player1-win', 'draw', 'player2-win')),
  player1_submission_time TIMESTAMPTZ,
  player2_submission_time TIMESTAMPTZ,
  dispute_status          TEXT        DEFAULT 'none'
                                      CHECK (dispute_status IN ('none', 'pending', 'conflict', 'escalated')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view tournament matches"  ON public.matches;
DROP POLICY IF EXISTS "Organizers can insert matches"       ON public.matches;
DROP POLICY IF EXISTS "Organizers can manage all matches"   ON public.matches;
DROP POLICY IF EXISTS "Players can update their own matches" ON public.matches;
DROP POLICY IF EXISTS "Organizers can delete matches"       ON public.matches;

CREATE POLICY "Anyone can view tournament matches"
  ON public.matches FOR SELECT USING (true);

CREATE POLICY "Organizers can insert matches"
  ON public.matches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments
      WHERE tournaments.id = matches.tournament_id
        AND (tournaments.organizer_id = auth.uid() OR tournaments.owner_id = auth.uid())
    )
  );

CREATE POLICY "Organizers can manage all matches"
  ON public.matches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments
      WHERE tournaments.id = matches.tournament_id
        AND (tournaments.organizer_id = auth.uid() OR tournaments.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments
      WHERE tournaments.id = matches.tournament_id
        AND (tournaments.organizer_id = auth.uid() OR tournaments.owner_id = auth.uid())
    )
  );

CREATE POLICY "Players can update their own matches"
  ON public.matches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE (players.id = matches.player1_id OR players.id = matches.player2_id)
        AND players.user_id = auth.uid()
        AND players.tournament_id = matches.tournament_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE (players.id = matches.player1_id OR players.id = matches.player2_id)
        AND players.user_id = auth.uid()
        AND players.tournament_id = matches.tournament_id
    )
  );

CREATE POLICY "Organizers can delete matches"
  ON public.matches FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments
      WHERE tournaments.id = matches.tournament_id
        AND (tournaments.organizer_id = auth.uid() OR tournaments.owner_id = auth.uid())
    )
  );

-- ──────────────────────────────────────────────────────────────
-- TOURNAMENT_INTEREST
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournament_interest (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id TEXT        NOT NULL,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

ALTER TABLE public.tournament_interest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tournament interest"
  ON public.tournament_interest FOR SELECT USING (true);

CREATE POLICY "Users can add own interest"
  ON public.tournament_interest FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own interest"
  ON public.tournament_interest FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tournament_interest_tournament
  ON public.tournament_interest(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_interest_user
  ON public.tournament_interest(user_id);

-- ──────────────────────────────────────────────────────────────
-- STORAGE: avatars bucket policies
-- (The bucket itself must be created via the Supabase Dashboard:
--  Storage > New bucket, name "avatars", public, 2 MB limit)
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can upload own avatar"       ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar"       ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar"       ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly readable" ON storage.objects;

CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

CREATE POLICY "Avatar images are publicly readable"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');
