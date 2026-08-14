import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// On web, supabase-js manages storage itself (localStorage when available);
// passing AsyncStorage there breaks server-side/Node execution.
const isWeb = Platform.OS === 'web';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    ...(isWeb ? {} : { storage: AsyncStorage }),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE is the recommended flow for mobile deep-linking: the OAuth callback
    // returns a single-use `?code=` we exchange for a session, instead of
    // implicit-flow tokens in a URL fragment. The code verifier is held in the
    // configured storage between launching the browser and the exchange.
    flowType: 'pkce',
  },
});

if (!isWeb) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
