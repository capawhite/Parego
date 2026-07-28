-- =============================================================
-- RLS join hardening
-- - Profile inserts only for own auth user
-- - Player inserts: organizers, or authenticated self-join into joinable events
-- - Guests join via server action (service role), not open anon INSERT
-- - Tournament SELECT: public, organizer/owner, or registered player already in field
--   (private guest link loads use service-role on the server)
-- =============================================================

-- ── users INSERT ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow profile creation during signup" ON public.users;
CREATE POLICY "Users can create own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ── tournaments SELECT ───────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view active tournaments" ON public.tournaments;
CREATE POLICY "Public organizer or member can view tournaments"
  ON public.tournaments FOR SELECT
  USING (
    COALESCE(visibility, 'public') = 'public'
    OR auth.uid() = organizer_id
    OR auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.tournament_id = tournaments.id
        AND p.user_id = auth.uid()
    )
  );

-- ── players INSERT ───────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can add players" ON public.players;

-- Organizer (or owner) may add anyone
CREATE POLICY "Organizers can add players"
  ON public.players FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = players.tournament_id
        AND (t.organizer_id = auth.uid() OR t.owner_id = auth.uid())
    )
  );

-- Registered users may self-join joinable tournaments
CREATE POLICY "Authenticated users can self-join joinable tournaments"
  ON public.players FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = players.tournament_id
        AND t.status IN ('setup', 'active')
        AND (
          t.status = 'setup'
          OR COALESCE((t.settings->>'allowLateJoin')::boolean, true) = true
        )
    )
  );

-- Narrow guest claim: only claim null user_id rows (unchanged intent) —
-- keep existing claim policy; no change required here.
