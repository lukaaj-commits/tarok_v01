/*
  # Restore original score_entries table
  
  Revert to working version without 'played' column
  
  1. Changes
    - Drop score_entries table completely
    - Recreate original version without 'played' column
    - Restore RLS policies
*/

-- Drop existing table
DROP TABLE IF EXISTS score_entries CASCADE;

-- Recreate original table (without 'played' column)
CREATE TABLE score_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  points integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE score_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to score_entries"
  ON score_entries FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to score_entries"
  ON score_entries FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to score_entries"
  ON score_entries FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to score_entries"
  ON score_entries FOR DELETE
  TO public
  USING (true);

CREATE INDEX IF NOT EXISTS idx_score_entries_player_id ON score_entries(player_id);
CREATE INDEX IF NOT EXISTS idx_score_entries_game_id ON score_entries(game_id);
