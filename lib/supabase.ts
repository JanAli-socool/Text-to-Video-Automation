import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Expo only exposes variables prefixed with EXPO_PUBLIC_ to the client bundle.
// Keep the client constructible when a developer has not created .env yet; the
// auth provider checks isSupabaseConfigured and shows the normal signed-out UI
// instead of crashing at module import time.
const configuredUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const configuredAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(configuredUrl && configuredAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    '[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Create a .env file from .env.example and restart Expo.'
  );
}

// createClient rejects empty strings. These values are never used for requests
// when configuration is missing because AuthContext short-circuits first.
const supabaseUrl = configuredUrl || 'https://missing-project.supabase.co';
const supabaseAnonKey = configuredAnonKey || 'missing-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
