-- RPC for signup: check if email is available (anon can call).
-- Returns true if no user has this email, false if taken.

CREATE OR REPLACE FUNCTION public.check_email_available(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE email IS NOT NULL
      AND LOWER(TRIM(email)) = LOWER(TRIM(NULLIF(p_email, '')))
  );
$$;

COMMENT ON FUNCTION public.check_email_available(text) IS 'Returns true if email is available for signup. Callable by anon.';

GRANT EXECUTE ON FUNCTION public.check_email_available(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_email_available(text) TO authenticated;
