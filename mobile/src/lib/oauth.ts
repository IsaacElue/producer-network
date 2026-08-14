// Google sign-in for Expo. Supabase's documented native pattern: open the
// provider URL in an auth session, then turn the returned deep link into a
// Supabase session. Uses the PKCE flow (see supabase.ts) so the callback
// carries a `?code=` we exchange, rather than implicit-flow fragment tokens.

import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

// Two runtime shapes, both must be on Supabase's "Redirect URLs" allow list
// (a mismatch makes GoTrue fall back to the Site URL — the "lands on the web
// login page" bug):
//   - Dev/prod build → `producernetwork://auth-callback` (the `native` value,
//     returned verbatim; stable, no LAN IP — this is the OAuth-friendly path).
//   - Expo Go → `exp://<LAN-IP>:8081` (the `native` branch is skipped for the
//     store client, so it falls through to the exp:// deep link).
export function getRedirectTo() {
  return makeRedirectUri({
    scheme: 'producernetwork',
    native: 'producernetwork://auth-callback',
  });
}

// Guard against processing the same callback twice (the browser return value
// and the deep-link listener can both deliver it): a PKCE code is single-use,
// so a second exchange would throw.
const processed = new Set<string>();

export async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const hasAuth = Boolean(params.code || (params.access_token && params.refresh_token));
  if (!hasAuth || processed.has(url)) return null;
  processed.add(url);

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return data.session;
  }
  const { data, error } = await supabase.auth.setSession({
    access_token: params.access_token,
    refresh_token: params.refresh_token,
  });
  if (error) throw error;
  return data.session;
}

export async function signInWithGoogle() {
  const redirectTo = getRedirectTo();
  if (__DEV__) {
    // Copy this exact value into Supabase → Authentication → URL Configuration
    // → Redirect URLs. It changes with your LAN IP.
    console.log('[oauth] add this to Supabase Redirect URLs:', redirectTo);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success') {
    await createSessionFromUrl(result.url);
  }
  // If the browser didn't hand back a URL (some OS/version combinations),
  // the deep-link listener in AuthProvider still catches the callback.
}
