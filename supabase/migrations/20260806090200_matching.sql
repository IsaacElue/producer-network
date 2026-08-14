-- Producer Network — matching module
--
-- The app calls exactly one thing: get_discovery_feed(). Everything about
-- how candidates are scored lives in this file, so a richer similarity
-- signal can be swapped in without the app or the rest of the schema
-- ever noticing.
--
-- Tiered scoring (PRD §6.2 order of signal strength):
--   1. exact reference overlap   shared artist 100 each, shared track +50 each
--   2. Last.fm similar-artist    25 per connected candidate artist, capped 75
--        (mid-tier; rescues cold start when exact overlap is near-zero)
--   3. shared taxonomy tags      subgenre 15 each capped 45, genre 5 each capped 15,
--        plus Spotify genre-array overlap 2 each capped 10 (best-effort data)
--   4. role complementarity      mutual (each wants the other's role) 40,
--        one-way (candidate has a role the viewer wants) 10
--
-- Hard filters, not scores: producer-to-X scope only (at least one side of
-- every pair must be a producer), no self, nobody already swiped on, no
-- blocked pair in either direction, only onboarded profiles.
--
-- Zero-score profiles are still returned, ranked last — with a small seed
-- network the feed must never be empty.

create or replace function public.get_discovery_feed(
  p_limit  integer default 25,
  p_offset integer default 0
)
returns table (
  profile_id           uuid,
  score                integer,
  shared_artist_names  text[],
  shared_track_names   text[],
  similar_artist_names text[],
  shared_tag_labels    text[],
  role_match           text
)
language sql
stable
set search_path = public
as $$
  with viewer as (
    select p.id, p.role, p.looking_for
    from public.profiles p
    where p.id = (select auth.uid())
  ),
  my_refs as (
    select * from public.sound_references
    where profile_id = (select auth.uid())
  ),
  my_artist_ids as (
    select distinct
      case when ref_type = 'artist' then spotify_id else artist_spotify_id end as artist_id
    from my_refs
    where ref_type = 'artist' or artist_spotify_id is not null
  ),
  my_artist_names as (
    select distinct
      lower(case when ref_type = 'artist' then name else artist_name end) as artist_name
    from my_refs
    where ref_type = 'artist' or artist_name is not null
  ),
  my_track_ids as (
    select spotify_id from my_refs where ref_type = 'track'
  ),
  my_genres as (
    select distinct g as genre from my_refs, unnest(genres) as g
  ),
  my_tags as (
    select tag_id from public.profile_tags
    where profile_id = (select auth.uid())
  ),
  candidates as (
    select p.id, p.created_at, p.role, p.looking_for
    from public.profiles p, viewer v
    where p.id <> v.id
      and p.onboarded
      and (v.role = 'producer' or p.role = 'producer')
      and not public.is_blocked(v.id, p.id)
      and not exists (
        select 1 from public.swipes s
        where s.swiper_id = v.id and s.swipee_id = p.id
      )
  ),
  cand_refs as (
    select r.*
    from public.sound_references r
    join candidates c on c.id = r.profile_id
  ),
  cand_artists as (
    select
      r.profile_id,
      case when r.ref_type = 'artist' then r.spotify_id else r.artist_spotify_id end as artist_id,
      lower(case when r.ref_type = 'artist' then r.name else r.artist_name end) as artist_name,
      case when r.ref_type = 'artist' then r.name else r.artist_name end as display_name
    from cand_refs r
    where r.ref_type = 'artist' or r.artist_spotify_id is not null
  ),
  artist_overlap as (
    select ca.profile_id, count(distinct ca.artist_id) as n,
           array_agg(distinct ca.display_name) as names
    from cand_artists ca
    join my_artist_ids a on a.artist_id = ca.artist_id
    group by ca.profile_id
  ),
  track_overlap as (
    select r.profile_id, count(*) as n, array_agg(distinct r.name) as names
    from cand_refs r
    join my_track_ids t on r.ref_type = 'track' and r.spotify_id = t.spotify_id
    group by r.profile_id
  ),
  similar_overlap as (
    select ca.profile_id, count(distinct ca.artist_name) as n,
           array_agg(distinct ca.display_name) as names
    from cand_artists ca
    where ca.artist_name is not null
      and ca.artist_name not in (select artist_name from my_artist_names)
      and exists (
        select 1
        from my_artist_names mine
        join public.similar_artists sa
          on (sa.artist_key = mine.artist_name and sa.similar_key = ca.artist_name)
          or (sa.artist_key = ca.artist_name and sa.similar_key = mine.artist_name)
      )
    group by ca.profile_id
  ),
  tag_overlap as (
    select pt.profile_id,
           count(*) filter (where t.kind = 'subgenre') as n_sub,
           count(*) filter (where t.kind = 'genre') as n_genre,
           array_agg(t.label) as labels
    from public.profile_tags pt
    join candidates c on c.id = pt.profile_id
    join my_tags mt on mt.tag_id = pt.tag_id
    join public.tag_options t on t.id = pt.tag_id
    group by pt.profile_id
  ),
  genre_overlap as (
    select r.profile_id, count(distinct g) as n
    from cand_refs r, unnest(r.genres) as g
    where g in (select genre from my_genres)
    group by r.profile_id
  )
  select
    c.id,
    (
      coalesce(ao.n, 0) * 100
      + coalesce(tro.n, 0) * 50
      + least(coalesce(so.n, 0) * 25, 75)
      + least(coalesce(tago.n_sub, 0) * 15, 45)
      + least(coalesce(tago.n_genre, 0) * 5, 15)
      + least(coalesce(go.n, 0) * 2, 10)
      + case
          when c.role = any(v.looking_for) and v.role = any(c.looking_for) then 40
          when c.role = any(v.looking_for) then 10
          else 0
        end
    )::integer as score,
    coalesce(ao.names, '{}'),
    coalesce(tro.names, '{}'),
    coalesce(so.names, '{}'),
    coalesce(tago.labels, '{}'),
    case
      when c.role = any(v.looking_for) and v.role = any(c.looking_for) then 'mutual'
      when c.role = any(v.looking_for) then 'one_way'
      else 'none'
    end
  from candidates c
  cross join viewer v
  left join artist_overlap ao  on ao.profile_id  = c.id
  left join track_overlap tro  on tro.profile_id = c.id
  left join similar_overlap so on so.profile_id  = c.id
  left join tag_overlap tago   on tago.profile_id = c.id
  left join genre_overlap go   on go.profile_id  = c.id
  order by 2 desc, c.created_at desc
  limit p_limit offset p_offset;
$$;
