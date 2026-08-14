-- Producer Network — link your own Spotify artist page
--
-- Distinct from sound_references (which are "I sound like X" inspiration tags):
-- these columns represent "this is MY Spotify artist profile". Optional and
-- commonly null. Populated at link time from GET /artists/{id} (Client
-- Credentials — no user OAuth). Readable by everyone via the existing
-- "profiles: authenticated can read" policy, so an artist page is public in
-- Discover with no match-gating.
--
-- Note: the immersive-view discography is deferred to Phase 2. Spotify's
-- /artists/{id}/top-tracks now returns 403 for Client-Credentials apps, but
-- /artists/{id}/albums still works — that decision belongs with the view.

alter table public.profiles
  add column spotify_artist_id        text,
  add column spotify_artist_name      text,
  add column spotify_artist_image_url text,
  add column spotify_artist_url       text,
  add column spotify_artist_genres    text[] not null default '{}';
