import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Dodamo nazaj za stabilnost

// 1. Project URL (Ta je bil pravilen)
const supabaseUrl = 'https://skzwyzrbctrgfwyljilw.supabase.co';

// 2. API Key - TUKAJ PRILEPI TISTEGA, KI SE ZAČNE Z "ey..."
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrend5enJiY3RyZ2Z3eWxqaWx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODE2OTUsImV4cCI6MjA4MDk1NzY5NX0.nk15ok0fSFkwtMO1q1gKlTMndOVTNTQ3XbP1lv9XJYw';

// -----------------------------------------------------

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// --- TIPI (Pustimo jih, da ostala koda deluje) ---
export type Database = {
  public: {
    Tables: {
      games: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          is_active?: boolean;
          created_at?: string;
        };
      };
      players: {
        Row: {
          id: string;
          game_id: string;
          name: string;
          position: number;
          total_score: number;
          created_at: string;
          profile_id?: string; // Dodan profile_id
        };
        Insert: {
          id?: string;
          game_id: string;
          name?: string;
          position: number;
          total_score?: number;
          created_at?: string;
          profile_id?: string; // Dodan profile_id
        };
        Update: {
          id?: string;
          game_id?: string;
          name?: string;
          position?: number;
          total_score?: number;
          created_at?: string;
          profile_id?: string; // Dodan profile_id
        };
      };
      score_entries: {
        Row: {
          id: string;
          player_id: string;
          game_id: string;
          points: number;
          played: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          player_id: string;
          game_id: string;
          points: number;
          played?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          game_id?: string;
          points?: number;
          played?: boolean;
          created_at?: string;
        };
      };
      radelci: {
        Row: {
          id: string;
          player_id: string;
          game_id: string;
          is_used: boolean;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          player_id: string;
          game_id: string;
          is_used?: boolean;
          position: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          game_id?: string;
          is_used?: boolean;
          position?: number;
          created_at?: string;
        };
      };
      // Dodana definicija za player_profiles, da bo TS zadovoljen
      player_profiles: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
      };
    };
  };
};
