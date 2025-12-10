/*
  # Create player profiles table for global player tracking

  1. New Tables
    - `player_profiles`
      - `id` (uuid, primary key)
      - `name` (text, unique) - unique player name
      - `created_at` (timestamptz) - when the profile was created

  2. Changes to existing tables
    - Add `player_profile_id` to `players` table (foreign key to player_profiles)

  3. Security
    - Enable RLS on `player_profiles` table
    - Add policy for anyone to read player profiles (needed for autocomplete)
    - Add policy for anyone to create new player profiles
*/

-- Create player_profiles table
CREATE TABLE IF NOT EXISTS player_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add player_profile_id to players table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'player_profile_id'
  ) THEN
    ALTER TABLE players ADD COLUMN player_profile_id uuid REFERENCES player_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read player profiles (needed for autocomplete)
CREATE POLICY "Anyone can view player profiles"
  ON player_profiles
  FOR SELECT
  USING (true);

-- Allow anyone to create player profiles
CREATE POLICY "Anyone can create player profiles"
  ON player_profiles
  FOR INSERT
  WITH CHECK (true);

-- Create index for faster name lookups
CREATE INDEX IF NOT EXISTS idx_player_profiles_name ON player_profiles(name);
CREATE INDEX IF NOT EXISTS idx_players_profile_id ON players(player_profile_id);