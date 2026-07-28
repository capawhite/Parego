-- Allow users to claim guest player rows (link past guest play to their account).
-- Used by the signup "Have you played before?" flow.
-- Only unclaimed rows (user_id IS NULL) can be updated, and only to set user_id = current user.

DROP POLICY IF EXISTS "Users can claim guest player rows" ON players;
CREATE POLICY "Users can claim guest player rows"
ON players FOR UPDATE
USING (user_id IS NULL)
WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY "Users can claim guest player rows" ON players IS 'Lets users link past guest play to their account at signup';
