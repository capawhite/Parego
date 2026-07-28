-- Add latitude and longitude columns to users table for nearby search
ALTER TABLE users
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Add index for faster geospatial queries
CREATE INDEX IF NOT EXISTS users_location_idx ON users(latitude, longitude);

-- Add comment
COMMENT ON COLUMN users.latitude IS 'User latitude coordinate for nearby tournament search';
COMMENT ON COLUMN users.longitude IS 'User longitude coordinate for nearby tournament search';
