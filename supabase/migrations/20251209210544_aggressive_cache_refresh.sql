/*
  # Aggressive schema cache refresh
  
  Force complete cache reload by modifying table comments
*/

-- Add comments to force cache refresh
COMMENT ON TABLE player_profiles IS 'Global player profiles for tracking across games';
COMMENT ON COLUMN players.player_profile_id IS 'Reference to global player profile';

-- Notify PostgREST again
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';