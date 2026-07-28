-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

-- Create a more permissive policy for initial signup
-- This allows inserting a profile during signup process
CREATE POLICY "Allow profile creation during signup"
  ON public.users FOR INSERT
  WITH CHECK (true);

-- Create a trigger function to automatically create user profile
-- Added city field to user profile creation
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

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
