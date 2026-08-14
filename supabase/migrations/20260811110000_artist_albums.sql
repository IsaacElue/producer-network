-- Producer Network — cache the linked artist's discography.
-- /artists/{id}/top-tracks is 403 for Client-Credentials apps, but
-- /artists/{id}/albums works, so the immersive profile view shows albums.
-- Snapshotted at link time as [{ id, name, imageUrl, releaseDate, type }].

alter table public.profiles
  add column spotify_artist_albums jsonb not null default '[]'::jsonb;
