import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- TVOJI PODATKI ---

const supabaseUrl = 'https://skzwyzrbctrgfwyljilw.supabase.co';

// Tvoj pravi anon key:
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrend5enJiY3RyZ2Z3eWxqaWx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzODE2OTUsImV4cCI6MjA4MDk1NzY5NX0.nk15ok0fSFkwtMO1q1gKlTMndOVTNTQ3XbP1lv9XJYw';

// ---------------------

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// --- DEFINICIJE TIPOV (Da bo TypeScript zadovoljen) ---
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
          profile_id?: string; 
        };
        Insert: {
          id?: string;
          game_id: string;
          name?: string;
          position: number;
          total_score?: number;
          created_at?: string;
          profile_id?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          name?: string;
          position?: number;
          total_score?: number;
          created_at?: string;
          profile_id?: string;
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
