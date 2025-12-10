/*
  # Add played column to score_entries
  
  1. Changes
    - Add `played` boolean column to track if player actually played
    - Default to false for existing entries
*/

-- Add played column
ALTER TABLE score_entries 
ADD COLUMN IF NOT EXISTS played boolean DEFAULT false;
