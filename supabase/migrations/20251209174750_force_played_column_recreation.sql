/*
  # Force recreation of played column
  
  1. Changes
    - Drop and recreate played column to force PostgREST refresh
*/

ALTER TABLE score_entries DROP COLUMN IF EXISTS played;
ALTER TABLE score_entries ADD COLUMN played boolean DEFAULT false;
