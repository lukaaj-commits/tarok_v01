/*
  # Restore original score_entries structure
  
  1. Changes
    - Remove played column from score_entries table
    - Restore to original 5-column structure (id, player_id, game_id, points, created_at)
*/

ALTER TABLE score_entries DROP COLUMN IF EXISTS played;
