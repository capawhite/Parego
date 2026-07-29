-- =============================================================
-- Fix infinite RLS recursion between tournaments <-> players
-- (42P17). Policies must not query each other under RLS; use
-- SECURITY DEFINER helpers that bypass RLS for membership checks.
-- =============================================================

CREATE OR REPLACE FUNCTION public.is_tournament_member(p_tournament_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.players
    WHERE tournament_id = p_tournament_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tournament_staff(p_tournament_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tournaments t
    WHERE t.id = p_tournament_id
      AND (t.organizer_id = auth.uid() OR t.owner_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_tournament_roster(p_tournament_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tournaments t
    WHERE t.id = p_tournament_id
      AND (
        COALESCE(t.visibility, 'public') = 'public'
        OR t.organizer_id = auth.uid()
        OR t.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.players p
          WHERE p.tournament_id = t.id
            AND p.user_id = auth.uid()
        )
        -- Live private join links (guests have no auth): allow during setup/active only
        OR t.status IN ('setup', 'active')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_joinable_tournament(p_tournament_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tournaments t
    WHERE t.id = p_tournament_id
      AND t.status IN ('setup', 'active')
      AND (
        t.status = 'setup'
        OR COALESCE((t.settings->>'allowLateJoin')::boolean, true) = true
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_tournament_member(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_tournament_staff(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_tournament_roster(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_joinable_tournament(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_tournament_member(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_tournament_staff(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_tournament_roster(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_joinable_tournament(text) TO anon, authenticated;

-- ── tournaments SELECT ───────────────────────────────────────
DROP POLICY IF EXISTS "Public organizer or member can view tournaments" ON public.tournaments;
CREATE POLICY "Public organizer or member can view tournaments"
  ON public.tournaments FOR SELECT
  USING (
    COALESCE(visibility, 'public') = 'public'
    OR auth.uid() = organizer_id
    OR auth.uid() = owner_id
    OR public.is_tournament_member(id)
  );

-- ── players SELECT ───────────────────────────────────────────
DROP POLICY IF EXISTS "View players for public live or authorized" ON public.players;
CREATE POLICY "View players for public live or authorized"
  ON public.players FOR SELECT
  USING (public.can_view_tournament_roster(tournament_id));

-- ── matches SELECT ───────────────────────────────────────────
DROP POLICY IF EXISTS "View matches for public live or authorized" ON public.matches;
CREATE POLICY "View matches for public live or authorized"
  ON public.matches FOR SELECT
  USING (public.can_view_tournament_roster(tournament_id));

-- ── players INSERT ───────────────────────────────────────────
DROP POLICY IF EXISTS "Organizers can add players" ON public.players;
CREATE POLICY "Organizers can add players"
  ON public.players FOR INSERT
  WITH CHECK (public.is_tournament_staff(tournament_id));

DROP POLICY IF EXISTS "Authenticated users can self-join joinable tournaments" ON public.players;
CREATE POLICY "Authenticated users can self-join joinable tournaments"
  ON public.players FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND public.is_joinable_tournament(tournament_id)
  );
