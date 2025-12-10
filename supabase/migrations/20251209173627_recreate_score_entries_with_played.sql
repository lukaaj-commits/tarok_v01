/*
  # Recreate score_entries table with played column
  
  Force PostgREST to recognize the played column by recreating the table.
  
  1. Changes
    - Backup existing data
    - Drop old table
    - Create new table with played column included
    - Restore data
    - Re-enable RLS and policies
*/

-- Backup data to temporary table
CREATE TEMP TABLE score_entries_backup AS 
SELECT id, player_id, game_id, points, created_at 
FROM score_entries;

-- Drop old table and cascade
DROP TABLE IF EXISTS score_entries CASCADE;

-- Create new table with played column
CREATE TABLE score_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  points integer NOT NULL,
  played boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Restore data
INSERT INTO score_entries (id, player_id, game_id, points, created_at, played)
SELECT id, player_id, game_id, points, created_at, false
FROM score_entries_backup;

-- Enable RLS
ALTER TABLE score_entries ENABLE ROW LEVEL SECURITY;

-- Recreate policies
CREATE POLICY "Anyone can view score entries"
  ON score_entries FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert score entries"
  ON score_entries FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update score entries"
  ON score_entries FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete score entries"
  ON score_entries FOR DELETE
  TO public
  USING (true);
