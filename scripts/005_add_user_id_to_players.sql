-- Add user_id column to link players to registered users
ALTER TABLE players ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_players_user_id ON players(user_id);

-- Add is_guest column to mark guest players
ALTER TABLE players ADD COLUMN is_guest BOOLEAN DEFAULT false;

COMMENT ON COLUMN players.user_id IS 'Links to registered user account if player is not a guest';
COMMENT ON COLUMN players.is_guest IS 'True if player joined as guest with auto-generated username';
