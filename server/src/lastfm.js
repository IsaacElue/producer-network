// Last.fm artist.getSimilar client — free API key, no user auth, verified
// available 2026-08. Last.fm is name-keyed (not Spotify-id-keyed), so
// similar-artist keys are lowercased artist names throughout the system.

const API_BASE = 'https://ws.audioscrobbler.com/2.0/';
const SIMILAR_LIMIT = 50;

export async function getSimilarArtists(artistName) {
  const params = new URLSearchParams({
    method: 'artist.getSimilar',
    artist: artistName,
    autocorrect: '1',
    limit: String(SIMILAR_LIMIT),
    api_key: process.env.LASTFM_API_KEY,
    format: 'json',
  });
  const res = await fetch(`${API_BASE}?${params}`);
  if (!res.ok) throw new Error(`Last.fm request failed: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Last.fm error ${data.error}: ${data.message}`);
  const artists = data.similarartists?.artist ?? [];
  return artists.map((a) => ({ name: a.name, match: Number(a.match) || 0 }));
}
