-- Enable RLS on players table
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view tournament players" ON players;
DROP POLICY IF EXISTS "Organizers can manage tournament players" ON players;
DROP POLICY IF EXISTS "Players can view their own data" ON players;
DROP POLICY IF EXISTS "Organizers can insert players" ON players;
DROP POLICY IF EXISTS "Organizers can delete players" ON players;

-- Policy 1: Anyone can view players in any tournament
-- This allows spectators to see who's playing
CREATE POLICY "Anyone can view tournament players"
ON players FOR SELECT
USING (true);

-- Policy 2: Only tournament organizers can update player records
-- This prevents players from modifying their own scores or stats
CREATE POLICY "Organizers can manage tournament players"
ON players FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = players.tournament_id 
    AND (tournaments.organizer_id = auth.uid() OR tournaments.owner_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = players.tournament_id 
    AND (tournaments.organizer_id = auth.uid() OR tournaments.owner_id = auth.uid())
  )
);

-- Policy 3: Only tournament organizers can add players
CREATE POLICY "Organizers can insert players"
ON players FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = players.tournament_id 
    AND (tournaments.organizer_id = auth.uid() OR tournaments.owner_id = auth.uid())
  )
);

-- Policy 4: Only tournament organizers can delete players
CREATE POLICY "Organizers can delete players"
ON players FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = players.tournament_id 
    AND (tournaments.organizer_id = auth.uid() OR tournaments.owner_id = auth.uid())
  )
);
