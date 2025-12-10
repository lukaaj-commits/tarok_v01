/*
  # Force PostgREST schema cache reload
  
  This migration forces PostgREST to reload its schema cache so that
  the new player_profiles table and player_profile_id column become visible.
*/

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';