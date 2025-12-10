/*
  # Refresh PostgREST schema cache
  
  1. Changes
    - Send NOTIFY signal to PostgREST to reload schema cache
*/

NOTIFY pgrst, 'reload schema';
