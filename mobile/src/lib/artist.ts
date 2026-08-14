import { supabase } from './supabase';
import type { SpotifyArtistDetail } from './types';

// Links / unlinks the signed-in user's own Spotify artist page on their
// profile. Separate from sound_references — this is "my music", not "who I
// sound like".
export async function linkArtist(userId: string, detail: SpotifyArtistDetail) {
  const { error } = await supabase
    .from('profiles')
    .update({
      spotify_artist_id: detail.spotifyId,
      spotify_artist_name: detail.name,
      spotify_artist_image_url: detail.imageUrl,
      spotify_artist_url: detail.url,
      spotify_artist_genres: detail.genres,
      spotify_artist_albums: detail.albums,
    })
    .eq('id', userId);
  if (error) throw error;
}

export async function unlinkArtist(userId: string) {
  const { error } = await supabase
    .from('profiles')
    .update({
      spotify_artist_id: null,
      spotify_artist_name: null,
      spotify_artist_image_url: null,
      spotify_artist_url: null,
      spotify_artist_genres: [],
      spotify_artist_albums: [],
    })
    .eq('id', userId);
  if (error) throw error;
}
