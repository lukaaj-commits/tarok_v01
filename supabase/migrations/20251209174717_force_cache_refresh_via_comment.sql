/*
  # Force schema cache refresh
  
  1. Changes
    - Add comment to table to force PostgREST cache reload
*/

COMMENT ON TABLE score_entries IS 'Score entries for players in games';
COMMENT ON COLUMN score_entries.played IS 'Indicates if player actually played';
