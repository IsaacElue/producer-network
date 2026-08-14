-- Producer Network — initial schema
-- profiles ← auth.users (1:1), tag_options/profile_tags (genre taxonomy),
-- sound_references, similar_artists (Last.fm cache), swipes, matches,
-- messages, blocks, reports

create type public.user_role as enum ('producer', 'vocalist', 'engineer', 'other');
create type public.reference_type as enum ('artist', 'track');
create type public.swipe_direction as enum ('like', 'pass');
create type public.tag_kind as enum ('genre', 'subgenre');

-- ── profiles ─────────────────────────────────────────────────────────
-- One row per auth user, created automatically by trigger on signup.
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text not null default '' check (char_length(display_name) <= 80),
  role           public.user_role,
  looking_for    public.user_role[] not null default '{}',  -- roles they want to connect with; first-class match signal
  bio            text not null default '' check (char_length(bio) <= 500),
  location       text,  -- optional display-only field, never a filter (PRD §5)
  avatar_url     text,
  instagram_url  text,
  tiktok_url     text,
  soundcloud_url text,
  youtube_url    text,
  onboarded      boolean not null default false,  -- hidden from discovery until profile setup completes
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── sound_references ─────────────────────────────────────────────────
-- "I sound like X" tags. Spotify data is denormalised here on purpose:
-- genres are captured at tag time because Spotify is actively thinning
-- the genres field, and audio-features are unavailable to post-2024 apps.
create table public.sound_references (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references public.profiles (id) on delete cascade,
  ref_type          public.reference_type not null,
  spotify_id        text not null,
  name              text not null,
  artist_name       text,  -- tracks only: primary artist's name
  artist_spotify_id text,  -- tracks only: primary artist's id, lets a track tag match an artist tag
  image_url         text,
  genres            text[] not null default '{}',  -- artist's genres; often empty for niche artists
  created_at        timestamptz not null default now(),
  unique (profile_id, ref_type, spotify_id)
);

create index sound_references_profile_id_idx on public.sound_references (profile_id);
create index sound_references_spotify_id_idx on public.sound_references (spotify_id);
create index sound_references_artist_spotify_id_idx on public.sound_references (artist_spotify_id);
create index sound_references_genres_idx on public.sound_references using gin (genres);

-- ── tag_options / profile_tags ───────────────────────────────────────
-- Curated genre/subgenre taxonomy for progressive onboarding (broad →
-- niche → optional Spotify reference). Seeded from supabase/seed.sql;
-- new scenes can be added with a plain insert, no app release needed.
create table public.tag_options (
  id         text primary key,  -- slug, e.g. 'uk-drill'
  label      text not null,
  kind       public.tag_kind not null,
  parent_id  text references public.tag_options (id) on delete cascade,
  sort_order integer not null default 0,
  check ((kind = 'genre') = (parent_id is null))
);

create table public.profile_tags (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tag_id     text not null references public.tag_options (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, tag_id)
);

create index profile_tags_tag_id_idx on public.profile_tags (tag_id);

-- ── similar_artists ──────────────────────────────────────────────────
-- Last.fm artist.getSimilar cache, written only by the server with the
-- service role when a Spotify reference is attached. Keyed by lowercased
-- artist name because Last.fm's API is name-keyed, not Spotify-id-keyed.
-- This is the mid-tier match signal that rescues cold start: exact
-- reference overlap is near-zero in a small seed network.
create table public.similar_artists (
  artist_key  text not null,
  similar_key text not null,
  match       real not null default 0,  -- Last.fm similarity 0..1
  fetched_at  timestamptz not null default now(),
  primary key (artist_key, similar_key)
);

create index similar_artists_similar_key_idx on public.similar_artists (similar_key);

-- ── blocks / reports ─────────────────────────────────────────────────
-- Required moderation surface for any UGC app (App Store guideline 1.2).
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_id_idx on public.blocks (blocked_id);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason      text not null check (char_length(reason) between 1 and 1000),
  created_at  timestamptz not null default now(),
  check (reporter_id <> reported_id)
);

-- ── swipes ───────────────────────────────────────────────────────────
create table public.swipes (
  id         uuid primary key default gen_random_uuid(),
  swiper_id  uuid not null references public.profiles (id) on delete cascade,
  swipee_id  uuid not null references public.profiles (id) on delete cascade,
  direction  public.swipe_direction not null,
  created_at timestamptz not null default now(),
  unique (swiper_id, swipee_id),
  check (swiper_id <> swipee_id)
);

create index swipes_swipee_id_idx on public.swipes (swipee_id);

-- ── matches ──────────────────────────────────────────────────────────
-- Created only by the swipe trigger on mutual like. user_a < user_b so
-- a pair can never appear twice in either order.
create table public.matches (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid not null references public.profiles (id) on delete cascade,
  user_b     uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);

create index matches_user_a_idx on public.matches (user_a);
create index matches_user_b_idx on public.matches (user_b);

create or replace function public.handle_swipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.direction = 'like' and exists (
    select 1 from public.swipes s
    where s.swiper_id = new.swipee_id
      and s.swipee_id = new.swiper_id
      and s.direction = 'like'
  ) then
    insert into public.matches (user_a, user_b)
    values (least(new.swiper_id, new.swipee_id), greatest(new.swiper_id, new.swipee_id))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger on_swipe_created
  after insert on public.swipes
  for each row execute function public.handle_swipe();

-- ── messages ─────────────────────────────────────────────────────────
create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index messages_match_id_created_at_idx on public.messages (match_id, created_at);

-- Realtime: chat messages and new matches push to subscribed clients.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.matches;
