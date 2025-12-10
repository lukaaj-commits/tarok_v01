/*
  # Refresh schema cache for score_entries

  This migration forces Supabase to refresh its schema cache by making a trivial change
  to the score_entries table structure, ensuring the 'played' column is properly recognized.
*/

-- Add a comment to refresh the schema cache
COMMENT ON COLUMN score_entries.played IS 'Indicates whether the player participated in this round';
