# Avatar storage setup (Supabase)

If users see **"Bucket not found"** or avatar upload fails after signup, the `avatars` bucket is not created yet. Do this once per project.

## 1. Create the bucket in Supabase Dashboard

1. Open your project: [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Storage** in the left sidebar.
3. Click **New bucket**.
4. Set:
   - **Name:** `avatars` (must be exactly this).
   - **Public bucket:** **ON** (so profile images can load without auth).
   - **File size limit:** `2 MB`.
   - **Allowed MIME types:** `image/jpeg`, `image/png`, `image/webp` (add each if the UI asks).
5. Click **Create bucket**.

## 2. Add storage policies (SQL)

The storage policies are part of the baseline migration
(**`supabase/migrations/20260310000000_baseline_schema.sql`**, storage section). If the baseline
is already applied, no extra SQL is needed. Otherwise run that migration's storage policies in
**SQL Editor**.

Those policies ensure:

- Authenticated users can upload/update/delete only their own file under `avatars/<user_id>/`.
- Anyone can read (public URLs for profile avatars).

After this, signup and profile avatar uploads should work. New signups will no longer see "Bucket not found."
