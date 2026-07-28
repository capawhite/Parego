-- =============================================================
-- Pairing lease: prevent concurrent pair ticks (cron + organizer
-- tabs / multi-TD) from creating duplicate matches.
-- =============================================================

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS pairing_lease_holder TEXT,
  ADD COLUMN IF NOT EXISTS pairing_lease_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tournaments_pairing_lease_until
  ON public.tournaments (pairing_lease_until)
  WHERE pairing_lease_until IS NOT NULL;

-- Atomically claim the pairing lease for a tournament.
-- Succeeds if unlocked, expired, or already held by the same holder.
CREATE OR REPLACE FUNCTION public.claim_pairing_lease(
  p_tournament_id text,
  p_holder text,
  p_ttl_seconds integer DEFAULT 20
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated integer;
  ttl integer := GREATEST(COALESCE(p_ttl_seconds, 20), 5);
BEGIN
  IF p_tournament_id IS NULL OR p_holder IS NULL OR length(trim(p_holder)) = 0 THEN
    RETURN false;
  END IF;

  UPDATE public.tournaments
  SET
    pairing_lease_holder = p_holder,
    pairing_lease_until = NOW() + make_interval(secs => ttl),
    updated_at = NOW()
  WHERE id = p_tournament_id
    AND (
      pairing_lease_until IS NULL
      OR pairing_lease_until < NOW()
      OR pairing_lease_holder = p_holder
    );

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_pairing_lease(
  p_tournament_id text,
  p_holder text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_tournament_id IS NULL OR p_holder IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.tournaments
  SET
    pairing_lease_holder = NULL,
    pairing_lease_until = NULL,
    updated_at = NOW()
  WHERE id = p_tournament_id
    AND pairing_lease_holder = p_holder;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_pairing_lease(text, text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_pairing_lease(text, text) TO anon, authenticated, service_role;
