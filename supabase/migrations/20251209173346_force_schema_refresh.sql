/*
  # Force Schema Cache Refresh
  
  This migration forces PostgREST to refresh its schema cache
  by making a minor change to the score_entries table.
*/

-- Add a temporary comment to force schema refresh
COMMENT ON COLUMN score_entries.played IS 'Indicates if player actively played in this game';

-- Notify PostgREST to reload
NOTIFY pgrst, 'reload schema';
