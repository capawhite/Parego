-- Avatars bucket: create in Supabase Dashboard (Storage > New bucket)
-- Name: avatars, Public: true, File size limit: 2MB, Allowed MIME: image/jpeg, image/png, image/webp
--
-- Then run the policies below in SQL Editor so authenticated users can upload
-- only to their own folder (avatars/<user_id>/...) and everyone can read.

-- Allow authenticated users to upload only to avatars/<their_user_id>/...
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
);

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
);

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
);

-- Public read so avatar URLs work in profile and leaderboards
DROP POLICY IF EXISTS "Avatar images are publicly readable" ON storage.objects;
CREATE POLICY "Avatar images are publicly readable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
