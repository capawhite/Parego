-- Enable RLS on tournaments table
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view active tournaments" ON tournaments;
DROP POLICY IF EXISTS "Organizers can manage their tournaments" ON tournaments;
DROP POLICY IF EXISTS "Authenticated users can create tournaments" ON tournaments;

-- Policy 1: Anyone (including anonymous) can view active/completed tournaments
-- This allows spectators to see ongoing tournaments
CREATE POLICY "Anyone can view active tournaments"
ON tournaments FOR SELECT
USING (true);

-- Policy 2: Only the tournament organizer can update their tournament
-- This prevents other users from starting/ending tournaments or changing settings
CREATE POLICY "Organizers can manage their tournaments"
ON tournaments FOR UPDATE
USING (
  auth.uid() = organizer_id OR 
  auth.uid() = owner_id
)
WITH CHECK (
  auth.uid() = organizer_id OR 
  auth.uid() = owner_id
);

-- Policy 3: Authenticated users can create tournaments
-- This allows logged-in users to create new tournaments
CREATE POLICY "Authenticated users can create tournaments"
ON tournaments FOR INSERT
WITH CHECK (
  auth.uid() = organizer_id OR 
  auth.uid() = owner_id
);

-- Policy 4: Organizers can delete their own tournaments
CREATE POLICY "Organizers can delete their tournaments"
ON tournaments FOR DELETE
USING (
  auth.uid() = organizer_id OR 
  auth.uid() = owner_id
);
