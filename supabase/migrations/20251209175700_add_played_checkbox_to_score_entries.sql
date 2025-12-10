/*
  # Add played checkbox field to score entries
  
  1. Changes
    - Add played column to score_entries table (boolean, default false)
    - This tracks whether a player actually played in the round
*/

ALTER TABLE score_entries ADD COLUMN IF NOT EXISTS played boolean DEFAULT false;
