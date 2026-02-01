-- Clean up all auth users and user profiles
-- WARNING: This deletes ALL users from the database

-- Delete all user profiles
DELETE FROM users;

-- Delete all auth users (this requires admin privileges)
-- Note: You may need to run this from the Supabase dashboard SQL editor
-- or use the Supabase Management API to delete auth users

-- For reference, to delete a specific auth user from the dashboard:
-- Go to Authentication > Users > Select user > Delete
