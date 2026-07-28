-- =============================================================
-- Security sprint: match write lockdown, guest claim, lease grants,
-- private players/matches SELECT (live events remain link-readable)
-- =============================================================

-- ── 1. Players cannot UPDATE matches (submissions go through service role API) ──
DROP POLICY IF EXISTS "Players can update their own matches" ON public.matches;

-- ── 2. Drop open guest-claim UPDATE (claims go through admin server action) ─────
DROP POLICY IF EXISTS "Users can claim guest player rows" ON public.players;

-- ── 3. Revoke anon EXECUTE on pairing lease RPCs ───────────────────────────
REVOKE EXECUTE ON FUNCTION public.claim_pairing_lease(text, text, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_pairing_lease(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pairing_lease(text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_pairing_lease(text, text) TO service_role;

-- ── 4. Tighten players SELECT (public / staff / member / live link access) ─
DROP POLICY IF EXISTS "Anyone can view tournament players" ON public.players;
CREATE POLICY "View players for public live or authorized"
  ON public.players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = players.tournament_id
        AND (
          COALESCE(t.visibility, 'public') = 'public'
          OR t.organizer_id = auth.uid()
          OR t.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.players me
            WHERE me.tournament_id = t.id
              AND me.user_id = auth.uid()
          )
          -- Live private join links (guests have no auth): allow during setup/active only
          OR t.status IN ('setup', 'active')
        )
    )
  );

-- ── 5. Tighten matches SELECT (same rules) ─────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view tournament matches" ON public.matches;
CREATE POLICY "View matches for public live or authorized"
  ON public.matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = matches.tournament_id
        AND (
          COALESCE(t.visibility, 'public') = 'public'
          OR t.organizer_id = auth.uid()
          OR t.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.players me
            WHERE me.tournament_id = t.id
              AND me.user_id = auth.uid()
          )
          OR t.status IN ('setup', 'active')
        )
    )
  );

-- ── 6. Dedicated heartbeat column (avoids settings JSON churn) ─────────────
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS pairing_heartbeat_at TIMESTAMPTZ;
