import { getArtistGenres, syncSimilarArtists } from './api';
import { supabase } from './supabase';
import type { SpotifySearchResult } from './types';

export async function attachReference(userId: string, r: SpotifySearchResult) {
  // Artist search results carry genres already; a track's artist genres cost
  // one extra server call, made only here at attach time (never per keystroke).
  let genres = r.genres ?? [];
  if (r.refType === 'track' && r.artistSpotifyId) {
    try {
      genres = await getArtistGenres(r.artistSpotifyId);
    } catch {
      genres = [];
    }
  }

  const { error } = await supabase.from('sound_references').insert({
    profile_id: userId,
    ref_type: r.refType,
    spotify_id: r.spotifyId,
    name: r.name,
    artist_name: r.artistName ?? null,
    artist_spotify_id: r.artistSpotifyId ?? null,
    image_url: r.imageUrl,
    genres,
  });
  // 23505 = already attached; treat as success
  if (error && error.code !== '23505') throw error;

  // Warm the Last.fm similar-artist cache for matching; never block the UI on it
  const artistName = r.refType === 'artist' ? r.name : r.artistName;
  if (artistName) {
    syncSimilarArtists(artistName).catch(() => {});
  }
}

export async function removeReference(id: string) {
  const { error } = await supabase.from('sound_references').delete().eq('id', id);
  if (error) throw error;
}
