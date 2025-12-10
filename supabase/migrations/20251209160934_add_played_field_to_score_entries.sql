/*
  # Add played field to score_entries

  1. Changes
    - Add `played` (boolean) column to `score_entries` table
      - Default value: false
      - Indicates whether the player actually played or just received points
  
  2. Purpose
    - Track which players actively played in each round
    - Display red indicator in history for played entries
    - Help users see who played the most
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'score_entries' AND column_name = 'played'
  ) THEN
    ALTER TABLE score_entries ADD COLUMN played BOOLEAN DEFAULT false;
  END IF;
END $$;
