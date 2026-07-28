-- Enable RLS on matches table
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view tournament matches" ON matches;
DROP POLICY IF EXISTS "Organizers can manage all matches" ON matches;
DROP POLICY IF EXISTS "Players can update their own matches" ON matches;
DROP POLICY IF EXISTS "Organizers can insert matches" ON matches;
DROP POLICY IF EXISTS "Organizers can delete matches" ON matches;

-- Policy 1: Anyone can view matches in any tournament
-- This allows spectators to follow the action
CREATE POLICY "Anyone can view tournament matches"
ON matches FOR SELECT
USING (true);

-- Policy 2: Tournament organizers can update any match in their tournament
-- This allows organizers to record results
CREATE POLICY "Organizers can manage all matches"
ON matches FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = matches.tournament_id 
    AND (tournaments.organizer_id = auth.uid() OR tournaments.owner_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = matches.tournament_id 
    AND (tournaments.organizer_id = auth.uid() OR tournaments.owner_id = auth.uid())
  )
);

-- Policy 3: Players can update matches they are participating in
-- This allows players to submit their own results
-- Note: This checks if the user_id of either player1 or player2 matches the authenticated user
CREATE POLICY "Players can update their own matches"
ON matches FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM players 
    WHERE (players.id = matches.player1_id OR players.id = matches.player2_id)
    AND players.user_id = auth.uid()
    AND players.tournament_id = matches.tournament_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM players 
    WHERE (players.id = matches.player1_id OR players.id = matches.player2_id)
    AND players.user_id = auth.uid()
    AND players.tournament_id = matches.tournament_id
  )
);

-- Policy 4: Only tournament organizers can create matches (pairing)
CREATE POLICY "Organizers can insert matches"
ON matches FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = matches.tournament_id 
    AND (tournaments.organizer_id = auth.uid() OR tournaments.owner_id = auth.uid())
  )
);

-- Policy 5: Only tournament organizers can delete matches
CREATE POLICY "Organizers can delete matches"
ON matches FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM tournaments 
    WHERE tournaments.id = matches.tournament_id 
    AND (tournaments.organizer_id = auth.uid() OR tournaments.owner_id = auth.uid())
  )
);
