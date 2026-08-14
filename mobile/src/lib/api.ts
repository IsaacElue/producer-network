// Client for our own Express server (the Spotify/Last.fm proxy).
// Everything else in the app talks straight to Supabase.

import { supabase } from './supabase';
import type { SpotifyArtistDetail, SpotifySearchResult } from './types';

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

async function authedFetch(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${path}`);
  }
  return res.json();
}

export async function searchSpotify(
  q: string,
  type: 'artist' | 'track',
): Promise<SpotifySearchResult[]> {
  const data = await authedFetch(
    `/api/search?type=${type}&q=${encodeURIComponent(q)}`,
  );
  return data.results;
}

export async function getArtistGenres(artistId: string): Promise<string[]> {
  const data = await authedFetch(`/api/artist-genres/${artistId}`);
  return data.genres;
}

// Full artist identity, fetched when a user links their own Spotify artist page.
export async function getArtist(artistId: string): Promise<SpotifyArtistDetail> {
  return authedFetch(`/api/artist/${artistId}`);
}

export async function syncSimilarArtists(artistName: string): Promise<void> {
  await authedFetch('/api/similar-artists/sync', {
    method: 'POST',
    body: JSON.stringify({ artistName }),
  });
}

// Permanently deletes the signed-in user's account (server cascades all data).
export async function deleteAccount(): Promise<void> {
  await authedFetch('/api/account', { method: 'DELETE' });
}
