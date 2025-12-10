/*
  # Revert to simple version without player profiles
  
  1. Changes
    - Drop player_profiles table
    - Remove player_profile_id column from players table
    
  2. Notes
    - This reverts back to the simple version where each game has its own players
*/

-- Remove player_profile_id column from players
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'player_profile_id'
  ) THEN
    ALTER TABLE players DROP COLUMN player_profile_id;
  END IF;
END $$;

-- Drop indexes if they exist
DROP INDEX IF EXISTS idx_players_profile_id;
DROP INDEX IF EXISTS idx_player_profiles_name;

-- Drop player_profiles table
DROP TABLE IF EXISTS player_profiles CASCADE;