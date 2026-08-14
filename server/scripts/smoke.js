// Producer Network backend smoke test. Run from server/: npm run smoke
//
// Covers, in order:
//   1. migrations + seed against the live database (needs SUPABASE_DB_URL;
//      skipped if the schema already exists — it never drops anything)
//   2. server boot + Spotify client-credentials exchange (reads boot logs)
//   3. real Spotify searches through the authed endpoint, incl. a niche
//      artist, asserting the limit<=10 cap
//   4. Last.fm artist.getSimilar via the sync endpoint + cache table rows
//   5. get_discovery_feed() behaviour: block exclusion (both directions),
//      reported-but-not-blocked still visible, producer-side hard filter,
//      role complementarity 40 mutual / 10 one-way, mutual-like match trigger
//
// Test users live at *@smoke.test and are deleted afterwards
// (pass --keep to leave them in place for manual poking).

import 'dotenv/config';
import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const KEEP_USERS = process.argv.includes('--keep');
const SERVER_PORT = 3999;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL = process.env.SUPABASE_DB_URL;
const TEST_DOMAIN = 'smoke.test';
const TEST_PASSWORD = 'smoke-test-password-1';

const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function fatal(message) {
  console.error(`\nABORT: ${message}`);
  process.exit(1);
}

const admin = createClient(SUPABASE_URL ?? '', SERVICE_KEY ?? '', {
  auth: { persistSession: false },
});

async function readAnonKey() {
  try {
    const envText = await readFile(path.join(repoRoot, 'mobile', '.env'), 'utf8');
    const line = envText
      .split(/\r?\n/)
      .find((l) => l.startsWith('EXPO_PUBLIC_SUPABASE_ANON_KEY='));
    return line?.slice('EXPO_PUBLIC_SUPABASE_ANON_KEY='.length).trim() || null;
  } catch {
    return null;
  }
}

async function runMigrations() {
  const { default: pg } = await import('pg');
  const client = new pg.Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const existing = await client.query("select to_regclass('public.profiles') as t");
    if (existing.rows[0].t) {
      console.log('Schema already present — skipping migrations, re-running seed only.');
    } else {
      const dir = path.join(repoRoot, 'supabase', 'migrations');
      for (const file of (await readdir(dir)).sort()) {
        await client.query(await readFile(path.join(dir, file), 'utf8'));
        console.log(`Applied ${file}`);
      }
    }
    await client.query(await readFile(path.join(repoRoot, 'supabase', 'seed.sql'), 'utf8'));
    const tags = await client.query('select count(*)::int as n from public.tag_options');
    check('migrations + seed applied', tags.rows[0].n > 0, `${tags.rows[0].n} tag_options rows`);
    // PostgREST doesn't see DDL from a direct connection until its schema
    // cache reloads — poke it so the REST checks below don't race it.
    await client.query("notify pgrst, 'reload schema'");
  } finally {
    await client.end();
  }
}

async function waitForRestSchema() {
  for (let i = 0; i < 30; i++) {
    const { error } = await admin.from('profiles').select('id').limit(1);
    if (!error) return;
    if (!/schema cache/i.test(error.message)) {
      throw new Error(`REST schema check: ${error.message}`);
    }
    await wait(1000);
  }
  throw new Error('PostgREST schema cache did not refresh within 30s');
}

async function cleanupTestUsers() {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  for (const user of data.users) {
    if (user.email?.endsWith(`@${TEST_DOMAIN}`)) {
      await admin.auth.admin.deleteUser(user.id);
    }
  }
}

async function createTestUser(name, role, lookingFor) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `${name}@${TEST_DOMAIN}`,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser ${name}: ${error.message}`);
  const { error: profileError } = await admin
    .from('profiles')
    .update({ display_name: name, role, looking_for: lookingFor, onboarded: true })
    .eq('id', data.user.id);
  if (profileError) throw new Error(`profile ${name}: ${profileError.message}`);
  return data.user.id;
}

async function signIn(name, anonKey) {
  const client = createClient(SUPABASE_URL, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({
    email: `${name}@${TEST_DOMAIN}`,
    password: TEST_PASSWORD,
  });
  if (error) throw new Error(`signIn ${name}: ${error.message}`);
  return { client, token: data.session.access_token };
}

async function feedFor(name, anonKey) {
  const { client } = await signIn(name, anonKey);
  const { data, error } = await client.rpc('get_discovery_feed');
  if (error) throw new Error(`feed ${name}: ${error.message}`);
  return new Map(data.map((row) => [row.profile_id, row]));
}

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/index.js'], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, PORT: String(SERVER_PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let logs = '';
    const onData = (chunk) => {
      logs += chunk.toString();
      if (logs.includes('listening')) resolve({ child, getLogs: () => logs });
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => reject(new Error(`server exited early (${code}):\n${logs}`)));
    setTimeout(() => reject(new Error(`server did not start within 15s:\n${logs}`)), 15000);
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    fatal('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from server/.env');
  }
  const anonKey = await readAnonKey();
  if (!anonKey) {
    fatal('EXPO_PUBLIC_SUPABASE_ANON_KEY missing from mobile/.env');
  }

  // ── 1. migrations + seed ─────────────────────────────────────────────
  if (DB_URL) {
    await runMigrations();
  } else {
    const { error } = await admin.from('tag_options').select('id').limit(1);
    if (error) {
      fatal(
        'Schema not found and SUPABASE_DB_URL not set. Either add SUPABASE_DB_URL ' +
          'to server/.env or run the migrations + seed in the SQL editor first.',
      );
    }
    console.log('SUPABASE_DB_URL not set — schema already present, continuing.');
  }
  await waitForRestSchema();

  // ── 5-prep. test users ───────────────────────────────────────────────
  await cleanupTestUsers();
  const ids = {
    p1: await createTestUser('p1', 'producer', ['vocalist']),
    v1: await createTestUser('v1', 'vocalist', ['producer']),
    e1: await createTestUser('e1', 'engineer', []),
    p2: await createTestUser('p2', 'producer', ['engineer']),
    p3: await createTestUser('p3', 'producer', []),
  };
  const { error: blockError } = await admin
    .from('blocks')
    .insert({ blocker_id: ids.p1, blocked_id: ids.p3 });
  if (blockError) throw new Error(`block insert: ${blockError.message}`);
  const { error: reportError } = await admin
    .from('reports')
    .insert({ reporter_id: ids.p1, reported_id: ids.p2, reason: 'smoke test report' });
  if (reportError) throw new Error(`report insert: ${reportError.message}`);

  // ── 5. discovery feed behaviour ──────────────────────────────────────
  const p1Feed = await feedFor('p1', anonKey);
  check('blocked user absent from blocker feed', !p1Feed.has(ids.p3));
  check('reported-but-not-blocked user still appears', p1Feed.has(ids.p2));
  check(
    'mutual role complementarity scores 40',
    p1Feed.get(ids.v1)?.score === 40 && p1Feed.get(ids.v1)?.role_match === 'mutual',
    `got score=${p1Feed.get(ids.v1)?.score}, role_match=${p1Feed.get(ids.v1)?.role_match}`,
  );
  check(
    'unsought role scores 0 but still appears',
    p1Feed.get(ids.e1)?.score === 0 && p1Feed.get(ids.e1)?.role_match === 'none',
    `got score=${p1Feed.get(ids.e1)?.score}`,
  );

  const p3Feed = await feedFor('p3', anonKey);
  check('block hides in both directions', !p3Feed.has(ids.p1));

  const p2Feed = await feedFor('p2', anonKey);
  check(
    'one-way role complementarity scores 10',
    p2Feed.get(ids.e1)?.score === 10 && p2Feed.get(ids.e1)?.role_match === 'one_way',
    `got score=${p2Feed.get(ids.e1)?.score}, role_match=${p2Feed.get(ids.e1)?.role_match}`,
  );

  const v1Feed = await feedFor('v1', anonKey);
  check('non-producer pair excluded (vocalist never sees engineer)', !v1Feed.has(ids.e1));
  check(
    'vocalist sees all producers',
    v1Feed.has(ids.p1) && v1Feed.has(ids.p2) && v1Feed.has(ids.p3),
  );

  // Mutual like → match trigger
  await admin.from('swipes').insert({ swiper_id: ids.v1, swipee_id: ids.p1, direction: 'like' });
  await admin.from('swipes').insert({ swiper_id: ids.p1, swipee_id: ids.v1, direction: 'like' });
  const [a, b] = ids.p1 < ids.v1 ? [ids.p1, ids.v1] : [ids.v1, ids.p1];
  const { data: match } = await admin
    .from('matches')
    .select('id')
    .eq('user_a', a)
    .eq('user_b', b)
    .maybeSingle();
  check('mutual like creates match via trigger', Boolean(match));
  const p1FeedAfter = await feedFor('p1', anonKey);
  check('swiped user leaves the feed', !p1FeedAfter.has(ids.v1));

  // ── 2-4. server boot, Spotify, Last.fm ───────────────────────────────
  const { child, getLogs } = await startServer();
  try {
    for (let i = 0; i < 20 && !/Spotify (OK|self-check FAILED)/.test(getLogs()); i++) {
      await wait(500);
    }
    check(
      'server boot: Spotify client-credentials exchange',
      getLogs().includes('Spotify OK'),
      getLogs().split('\n').find((l) => l.includes('Spotify')) ?? 'no Spotify log line',
    );

    const { token } = await signIn('p1', anonKey);
    const api = async (pathname, init) => {
      const res = await fetch(`http://localhost:${SERVER_PORT}${pathname}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        },
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    };

    const unauthed = await fetch(`http://localhost:${SERVER_PORT}/api/search?q=test&type=artist`);
    check('search endpoint rejects missing token', unauthed.status === 401);

    const mainstream = await api('/api/search?type=artist&q=metro%20boomin');
    check(
      'artist search returns results within limit cap',
      mainstream.status === 200 &&
        mainstream.body.results.length > 0 &&
        mainstream.body.results.length <= 10,
      `${mainstream.body?.results?.length ?? 0} results, first: ${mainstream.body?.results?.[0]?.name}`,
    );

    const niche = await api('/api/search?type=artist&q=kojaque');
    check(
      'niche artist search returns results',
      niche.status === 200 && niche.body.results.length > 0,
      `first: ${niche.body?.results?.[0]?.name}, genres: [${niche.body?.results?.[0]?.genres?.join(', ')}]`,
    );

    const tracks = await api('/api/search?type=track&q=shook%20ones');
    const firstTrack = tracks.body?.results?.[0];
    check(
      'track search returns results with artist ids',
      tracks.status === 200 && Boolean(firstTrack?.artistSpotifyId),
      `first: ${firstTrack?.name} — ${firstTrack?.artistName}`,
    );

    if (firstTrack?.artistSpotifyId) {
      const genres = await api(`/api/artist-genres/${firstTrack.artistSpotifyId}`);
      check(
        'artist-genres lookup works',
        genres.status === 200 && Array.isArray(genres.body.genres),
        `genres: [${genres.body?.genres?.join(', ')}]`,
      );
    }

    const sync = await api('/api/similar-artists/sync', {
      method: 'POST',
      body: JSON.stringify({ artistName: 'Mobb Deep' }),
    });
    check(
      'Last.fm similar-artist sync succeeds',
      sync.status === 200,
      JSON.stringify(sync.body),
    );
    const { count } = await admin
      .from('similar_artists')
      .select('*', { count: 'exact', head: true })
      .eq('artist_key', 'mobb deep');
    check('similar_artists cache populated', (count ?? 0) > 0, `${count} cached rows`);
  } finally {
    child.kill();
  }

  // ── cleanup + summary ────────────────────────────────────────────────
  if (!KEEP_USERS) {
    await cleanupTestUsers();
    console.log('Test users removed.');
  } else {
    console.log('Test users kept (--keep).');
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`\nSmoke test crashed: ${err.message}`);
  process.exit(1);
});
