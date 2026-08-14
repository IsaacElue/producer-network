import 'dotenv/config';
import express from 'express';
import { requireSupabaseUser } from './auth.js';
import { getSimilarArtists } from './lastfm.js';
import { getArtist, getArtistGenres, searchArtists, searchTracks } from './spotify.js';
import { supabaseAdmin } from './supabaseAdmin.js';

const app = express();

// Native apps don't need CORS, but the Expo web build (dev convenience) does.
// Endpoints are JWT-protected, so a permissive origin is fine.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true }));

// Live search against Spotify's catalog. type=artist results include genres;
// type=track results do not (see spotify.js) — fetch those on attach.
app.get('/api/search', requireSupabaseUser(), async (req, res) => {
  const { q, type = 'artist' } = req.query;
  if (typeof q !== 'string' || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query param "q" must be at least 2 characters' });
  }
  if (type !== 'artist' && type !== 'track') {
    return res.status(400).json({ error: 'Query param "type" must be "artist" or "track"' });
  }
  try {
    const results =
      type === 'artist' ? await searchArtists(q.trim()) : await searchTracks(q.trim());
    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Spotify search failed' });
  }
});

// Full artist identity for linking a user's own Spotify artist page.
app.get('/api/artist/:id', requireSupabaseUser(), async (req, res) => {
  const { id } = req.params;
  if (!/^[0-9A-Za-z]{10,40}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid artist id' });
  }
  try {
    res.json(await getArtist(id));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Spotify artist lookup failed' });
  }
});

// Called once when a track reference is attached, to store the artist's
// genres alongside the tag.
app.get('/api/artist-genres/:artistId', requireSupabaseUser(), async (req, res) => {
  const { artistId } = req.params;
  if (!/^[0-9A-Za-z]{10,40}$/.test(artistId)) {
    return res.status(400).json({ error: 'Invalid artist id' });
  }
  try {
    res.json({ genres: await getArtistGenres(artistId) });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Spotify artist lookup failed' });
  }
});

// Fire-and-forget from the app whenever a reference is attached: caches the
// referenced artist's Last.fm similar list so get_discovery_feed() can use
// it as the mid-tier signal. Skips artists synced within the last 30 days.
const SYNC_TTL_MS = 30 * 24 * 60 * 60 * 1000;

app.post(
  '/api/similar-artists/sync',
  requireSupabaseUser(),
  express.json(),
  async (req, res) => {
    const artistName =
      typeof req.body?.artistName === 'string' ? req.body.artistName.trim() : '';
    if (!artistName || artistName.length > 300) {
      return res.status(400).json({ error: 'Body must include artistName' });
    }
    const artistKey = artistName.toLowerCase();
    try {
      const { data: existing, error: readError } = await supabaseAdmin
        .from('similar_artists')
        .select('fetched_at')
        .eq('artist_key', artistKey)
        .limit(1);
      if (readError) throw readError;
      if (
        existing.length > 0 &&
        Date.now() - new Date(existing[0].fetched_at).getTime() < SYNC_TTL_MS
      ) {
        return res.json({ synced: false, reason: 'fresh' });
      }

      const similar = await getSimilarArtists(artistName);
      const rows = new Map();
      for (const s of similar) {
        const key = s.name.toLowerCase();
        if (key && key !== artistKey && !rows.has(key)) {
          rows.set(key, {
            artist_key: artistKey,
            similar_key: key,
            match: s.match,
            fetched_at: new Date().toISOString(),
          });
        }
      }
      if (rows.size > 0) {
        const { error } = await supabaseAdmin
          .from('similar_artists')
          .upsert([...rows.values()], { onConflict: 'artist_key,similar_key' });
        if (error) throw error;
      }
      res.json({ synced: true, count: rows.size });
    } catch (err) {
      console.error(err);
      res.status(502).json({ error: 'Similar-artist sync failed' });
    }
  },
);

// Boot self-check: proves the Client Credentials exchange works without
// waiting for the first real user search.
async function selfCheck() {
  try {
    const results = await searchArtists('daft punk');
    console.log(
      `Spotify OK — client-credentials token obtained, test search returned ${results.length} artists`,
    );
  } catch (err) {
    console.error(`Spotify self-check FAILED: ${err.message}`);
  }
  if (!process.env.LASTFM_API_KEY) {
    console.warn('LASTFM_API_KEY not set — similar-artist sync will fail');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set — similar-artist sync will fail');
  }
}

// Permanently delete the caller's own account. Deleting the auth.users row
// cascades through the FK chain (profiles → references, tags, swipes, matches,
// messages, blocks, reports). Uses the service role; the user can only ever
// delete themselves because the id comes from their verified JWT.
app.delete('/api/account', requireSupabaseUser(), async (req, res) => {
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.userId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Account deletion failed' });
  }
});

const port = process.env.PORT ?? 3001;
app.listen(port, () => {
  console.log(`Producer Network server listening on :${port}`);
  selfCheck();
});
