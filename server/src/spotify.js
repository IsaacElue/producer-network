// Spotify Web API client — Client Credentials flow (app-level token, no user
// Spotify login).
//
// Endpoint status verified 2026-08 against the official docs and changelog:
//   available:  GET /search (limit capped at 10 since Feb 2026),
//               GET /artists/{id}, GET /tracks/{id}
//   unavailable to post-Nov-2024 apps: /audio-features, /audio-analysis,
//               /recommendations, /artists/{id}/related-artists,
//               and (removed Feb 2026) batch GET /artists?ids=
//
// The artist `genres` field is deprecated-but-still-returned and often empty
// for niche artists — treat it as best-effort everywhere.

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';
const SEARCH_LIMIT = 10; // hard maximum since Feb 2026

let cachedToken = null; // { accessToken, expiresAt }

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.accessToken;
  }
  const creds = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
  ).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`Spotify token request failed: ${res.status}`);
  const data = await res.json();
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.accessToken;
}

async function spotifyGet(path) {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Spotify request failed: ${res.status} ${path}`);
  return res.json();
}

const pickImage = (images) => images?.[1]?.url ?? images?.[0]?.url ?? null;

export async function searchArtists(query) {
  const data = await spotifyGet(
    `/search?type=artist&limit=${SEARCH_LIMIT}&q=${encodeURIComponent(query)}`,
  );
  return (data.artists?.items ?? []).map((a) => ({
    refType: 'artist',
    spotifyId: a.id,
    name: a.name,
    imageUrl: pickImage(a.images),
    genres: a.genres ?? [],
  }));
}

// Track search returns simplified artist objects with no genres. The app
// fetches genres via getArtistGenres only when a track is actually attached
// as a reference, not on every search keystroke.
export async function searchTracks(query) {
  const data = await spotifyGet(
    `/search?type=track&limit=${SEARCH_LIMIT}&q=${encodeURIComponent(query)}`,
  );
  return (data.tracks?.items ?? []).map((t) => ({
    refType: 'track',
    spotifyId: t.id,
    name: t.name,
    artistName: t.artists?.[0]?.name ?? null,
    artistSpotifyId: t.artists?.[0]?.id ?? null,
    imageUrl: pickImage(t.album?.images),
  }));
}

// Batch GET /artists?ids= was removed in Feb 2026, so genres cost one request
// per artist — cache them in memory (fine for a single small instance).
const genresCache = new Map(); // artistId -> { genres, fetchedAt }
const GENRES_TTL_MS = 24 * 60 * 60 * 1000;

export async function getArtistGenres(artistId) {
  const hit = genresCache.get(artistId);
  if (hit && Date.now() - hit.fetchedAt < GENRES_TTL_MS) return hit.genres;
  const artist = await spotifyGet(`/artists/${encodeURIComponent(artistId)}`);
  const genres = artist.genres ?? [];
  genresCache.set(artistId, { genres, fetchedAt: Date.now() });
  return genres;
}

// Full artist identity + discography for the "link my Spotify artist page"
// flow. Uses GET /artists/{id} and /artists/{id}/albums, both of which still
// work with Client Credentials (unlike /top-tracks, which is 403 for
// post-2024 apps). Albums are deduped by name (Spotify returns per-market and
// album/single duplicates) and returned newest-first.
export async function getArtist(artistId) {
  const id = encodeURIComponent(artistId);
  const [a, albumsRaw] = await Promise.all([
    spotifyGet(`/artists/${id}`),
    // limit is capped at 10 since Feb 2026 (same as search).
    spotifyGet(`/artists/${id}/albums?include_groups=album,single&market=US&limit=10`),
  ]);

  const seen = new Set();
  const albums = [];
  for (const al of albumsRaw.items ?? []) {
    const key = al.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    albums.push({
      id: al.id,
      name: al.name,
      imageUrl: pickImage(al.images),
      releaseDate: al.release_date ?? null,
      type: al.album_type ?? 'album',
    });
  }
  albums.sort((x, y) => (y.releaseDate ?? '').localeCompare(x.releaseDate ?? ''));

  return {
    spotifyId: a.id,
    name: a.name,
    imageUrl: pickImage(a.images),
    url: a.external_urls?.spotify ?? null,
    genres: a.genres ?? [],
    albums,
  };
}
