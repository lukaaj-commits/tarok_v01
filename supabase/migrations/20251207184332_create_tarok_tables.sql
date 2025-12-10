/*
  # Tarok 2 - Card Game Score Tracking System

  1. New Tables
    - `games`
      - `id` (uuid, primary key)
      - `name` (text) - Auto-generated date-based name
      - `is_active` (boolean) - Marks the currently active game
      - `created_at` (timestamptz)
      
    - `players`
      - `id` (uuid, primary key)
      - `game_id` (uuid, foreign key to games)
      - `name` (text) - Player name (optional)
      - `position` (integer) - Display order
      - `total_score` (integer) - Current total score
      - `created_at` (timestamptz)
      
    - `score_entries`
      - `id` (uuid, primary key)
      - `player_id` (uuid, foreign key to players)
      - `game_id` (uuid, foreign key to games)
      - `points` (integer) - Score change (positive or negative)
      - `created_at` (timestamptz)
      
    - `radelci`
      - `id` (uuid, primary key)
      - `player_id` (uuid, foreign key to players)
      - `game_id` (uuid, foreign key to games)
      - `is_used` (boolean) - Whether bonus circle is used
      - `position` (integer) - Display order
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for public access (no authentication required for this app)
*/

-- Games table
CREATE TABLE IF NOT EXISTS games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to games"
  ON games FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to games"
  ON games FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to games"
  ON games FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to games"
  ON games FOR DELETE
  TO public
  USING (true);

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name text DEFAULT '',
  position integer NOT NULL,
  total_score integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to players"
  ON players FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to players"
  ON players FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to players"
  ON players FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to players"
  ON players FOR DELETE
  TO public
  USING (true);

-- Score entries table
CREATE TABLE IF NOT EXISTS score_entries (
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

-- Radelci (bonus circles) table
CREATE TABLE IF NOT EXISTS radelci (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  is_used boolean DEFAULT false,
  position integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE radelci ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to radelci"
  ON radelci FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to radelci"
  ON radelci FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to radelci"
  ON radelci FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to radelci"
  ON radelci FOR DELETE
  TO public
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_players_game_id ON players(game_id);
CREATE INDEX IF NOT EXISTS idx_score_entries_player_id ON score_entries(player_id);
CREATE INDEX IF NOT EXISTS idx_score_entries_game_id ON score_entries(game_id);
CREATE INDEX IF NOT EXISTS idx_radelci_player_id ON radelci(player_id);
CREATE INDEX IF NOT EXISTS idx_radelci_game_id ON radelci(game_id);
CREATE INDEX IF NOT EXISTS idx_games_is_active ON games(is_active);