# Producer Network

A networking/discovery app centered on producers — producer-to-producer,
producer-to-vocalist, producer-to-engineer — matching on **specific sound
reference** (genre → sub-genre/scene → real Spotify artists/tracks), not broad
category tags. Full product context: [docs/prd.md](docs/prd.md).

Discovery + connection only — no marketplace, no distribution, and **no in-app
audio upload/storage** (profile links to Instagram/TikTok/SoundCloud/YouTube
are the showcase mechanism).

## Repo layout

```
mobile/     Expo (React Native) app — expo-router + TypeScript, SDK 57
server/     Minimal Express proxy for Spotify + Last.fm (holds all secrets)
supabase/   Postgres migrations (schema, RLS, matching) + taxonomy seed
docs/       PRD
```

## Architecture in one paragraph

The mobile app talks directly to Supabase (auth, profiles, tags, references,
swipes, matches, blocks/reports, realtime chat) using the anon key + RLS. The
Express server holds the secrets Supabase can't: it proxies Spotify search /
artist-genre lookups and syncs Last.fm similar-artist lists into a shared
cache table, authenticating callers by verifying their Supabase JWT against
the project's JWKS. Discovery ranking runs entirely in Postgres via the
`get_discovery_feed()` RPC — the app never implements matching logic.

## Matching model (tiered)

All scoring lives in
[supabase/migrations/20260806090200_matching.sql](supabase/migrations/20260806090200_matching.sql)
behind the single `get_discovery_feed()` RPC, so richer signals can be swapped
in without touching the app:

1. **Exact reference overlap** — shared artist 100 pts, shared track +50 pts
2. **Last.fm similar-artist overlap** (`artist.getSimilar`, free API) — 25 pts
   per connected artist, capped at 75. This is the cold-start rescue: exact
   overlap is near-zero in a small seed network.
3. **Shared genre/sub-genre tags** — subgenre 15 (cap 45), genre 5 (cap 15),
   plus Spotify genre-array overlap 2 (cap 10, best-effort data)
4. **Role complementarity** — `role` vs `looking_for`: mutual 40, one-way 10

Hard filters (not scores): at least one side of every pair must be a producer
(producer-to-X scope), no blocked pairs, no repeats, onboarded profiles only.
Zero-score profiles still appear, ranked last — the feed is never empty at
seed scale.

## Onboarding flow (progressive, broad → niche)

1. Profile: name, role, **looking for** (roles), bio, links, optional location
2. Broad genre picker (tag chips, seeded taxonomy — no blank page)
3. Sub-genre/scene picker (trap, UK drill, Irish rap, …) filtered by step 2
4. Optional: Spotify artist/track references for max precision

The taxonomy lives in the `tag_options` table (seeded from
[supabase/seed.sql](supabase/seed.sql)) — adding a scene later is a plain
insert, no app release.

## External API constraints (verified 2026-08)

**Spotify** — apps created after 27 Nov 2024 cannot use `/audio-features`,
`/audio-analysis`, `/recommendations`, or `/related-artists`. Since Feb 2026:
batch `GET /artists?ids=` removed, search `limit` capped at 10, artist
`followers`/`popularity` fields gone. Artist `genres` is
deprecated-but-still-returned and often empty for niche artists — so genres
are snapshotted onto `sound_references` at tag time and treated as a weak
fallback signal only. Track-artist genres are fetched one artist at a time,
only on attach, cached server-side.

**Last.fm** — `artist.getSimilar` is available with a free API key
(non-commercial use). It's name-keyed, so the `similar_artists` cache is keyed
by lowercased artist name.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. Run the three files in `supabase/migrations/` **in filename order**, then
   `supabase/seed.sql`, in the SQL Editor (or `supabase db push` + seed with
   the CLI).
3. Auth → Providers: enable **Email** and **Google**. For a friction-free seed
   phase, consider disabling "Confirm email".
4. Auth → JWT Keys: make sure the project uses **asymmetric signing keys**
   (default for new projects) — the server verifies tokens via JWKS.

### 2. API keys

- Spotify: create an app at
  [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
  (Client Credentials only, no redirect URI).
- Last.fm: create a free API account at
  [last.fm/api/account/create](https://www.last.fm/api/account/create).

### 3. Server

```
cd server
cp .env.example .env   # fill in Spotify, Last.fm, Supabase URL + service key
npm install
npm run dev
```

Deploy target: any free/near-free Node host (Railway, Render, Fly). Stateless
apart from in-memory caches, so cold starts are harmless.

### 4. Mobile app

```
cd mobile
cp .env.example .env   # Supabase URL + anon key, server URL
npm install
npx expo start
```

The app targets **Expo SDK 54** — the newest SDK the App Store / Play Store
build of Expo Go supports (Apple approval has kept it there since May 2026).
Don't upgrade the SDK while Expo Go is the test vehicle. On a real device set
`EXPO_PUBLIC_API_URL` to your machine's LAN IP (not `localhost`) so the phone
can reach the Spotify/Last.fm proxy.

### Google sign-in redirect config

The OAuth callback uses the PKCE flow and a redirect URL from
`makeRedirectUri()`, which **must be on Supabase's allow list verbatim** or
GoTrue falls back to the Site URL (the classic "lands on the web login page
instead of returning to the app" bug). The value depends on how you're running:

- **Dev/production build:** `producernetwork://auth-callback` — stable, no IP.
  This is the reliable OAuth path (see "Development build" below).
- **Expo Go (dev):** `exp://<LAN-IP>:8081` — changes with your IP. On tapping
  "Continue with Google" the app logs the exact string as
  `[oauth] add this to Supabase Redirect URLs: …`; copy that. Expo Go's bare
  `exp://` deep link does not reliably hand control back to the app after
  OAuth, which is the whole reason a dev build exists — use Expo Go for
  everything except Google sign-in.

In Supabase → Authentication → URL Configuration → **Redirect URLs**, add all
you need. Metro is pinned to **port 8081** (`npm start` passes `--port 8081`)
so the Expo Go redirect stays constant across sessions instead of drifting to
8082+ when a port is briefly held. Use wildcards so you don't chase the LAN IP
(and, as insurance, the port) every session:

```
producernetwork://auth-callback
producernetwork://**
exp://192.168.0.8:8081
exp://192.168.0.8:*/**
```

If `npm start` reports 8081 is taken, a stale Metro is holding it — kill it
rather than letting Expo pick another port (that reintroduces the mismatch).

Enable Google under Authentication → Providers (client ID + secret from a
Google Cloud OAuth client).

**WebCrypto / PKCE (`s256` not `plain`):** Expo Go's Hermes engine has no
`crypto.subtle`, so supabase-js would silently downgrade the PKCE challenge to
`code_challenge_method=plain` (logged as "WebCrypto API is not supported").
`mobile/src/lib/polyfills.ts` backs `crypto.getRandomValues` and
`crypto.subtle.digest` with `expo-crypto` (plus `btoa`/`atob` shims), loaded
first via `mobile/index.js` before the app boots, so real SHA-256 `s256` is
used. Don't remove that entry indirection.

### Development build (the reliable Google sign-in path)

Expo Go can't register the `producernetwork://` scheme, so its OAuth redirect
is a fragile `exp://` deep link. A **development build** is a real app binary
with the scheme baked in, so `producernetwork://auth-callback` routes straight
back into the app. It still connects to Metro for fast JS reloads — you only
rebuild when native config changes.

Already configured here: `eas.json` (development profile), `expo-dev-client`,
the `producernetwork` scheme, iOS `bundleIdentifier`, Android `package`, and
the EAS `projectId`/`owner` in `app.json`.

To build and use it:

```
npm install -g eas-cli        # if not already global
eas login
eas build --profile development --platform android   # APK, free
# or --platform ios  (requires an Apple Developer account to register the device)
```

When the build finishes, EAS gives a QR/link — install it on the phone. Then
`npm start`, and open the project from the **dev build app** (not Expo Go).
Add `producernetwork://auth-callback` to Supabase Redirect URLs and Google
sign-in returns to the app.

Platform note: an Android dev build installs as a free APK. An iOS dev build
on a physical device requires an Apple Developer membership (~$99/yr) to
register the device UDID — there's no free sideload path for iOS.

## Moderation

`blocks` and `reports` tables ship in the base schema (required for App Store
review of UGC apps). Blocking hides both users from each other everywhere
(enforced in the feed RPC and message RLS); reports are write-only from the
app and reviewed in the Supabase dashboard.

## Cost

Supabase free tier + Expo + one free-tier Node host + Spotify Web API (free) +
Last.fm API (free, non-commercial). Nothing paid until App Store/Play Store
fees.
