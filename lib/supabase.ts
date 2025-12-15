import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// --- TVOJI PRAVI PODATKI (Prepisani iz tvojih slik) ---

// 1. Project URL (iz tvoje slike .env.local)
const supabaseUrl = 'https://skzwyzrbctrgfwyljilw.supabase.co';

// 2. API Key (iz tvoje slike .env.local - sb_publishable...)
const supabaseAnonKey = 'sb_publishable_1KgDO8xo2IcyT76urJNDlw_EXSvH-7d';

// -----------------------------------------------------

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Pustimo false, kot si imel v originalu
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
