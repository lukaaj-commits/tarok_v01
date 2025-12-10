import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
});

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
        };
        Insert: {
          id?: string;
          game_id: string;
          name?: string;
          position: number;
          total_score?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          name?: string;
          position?: number;
          total_score?: number;
          created_at?: string;
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
    };
  };
};
