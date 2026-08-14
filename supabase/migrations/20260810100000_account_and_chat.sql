-- Producer Network — account management + chat additions
--   1. matches DELETE policy → lets a match member remove the match
--      ("Delete conversation" = unmatch; cascades messages)
--   2. get_profile_card() → same match-signal shape as get_discovery_feed()
--      but for ONE target, with no swipe/onboarded/producer exclusions, so a
--      matched user's card (incl. "why you match") is viewable from chat.
-- Account deletion itself is done server-side via the admin API (deleting the
-- auth.users row cascades profiles → everything), so it needs no SQL here.

-- ── matches: members can delete (unmatch) ────────────────────────────
create policy "matches: members can delete"
  on public.matches for delete
  to authenticated
  using ((select auth.uid()) in (user_a, user_b));

-- ── get_profile_card: single-profile match signals ───────────────────
create or replace function public.get_profile_card(p_target uuid)
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
  -- Just the requested profile; no swipe/onboarded/producer filters (viewing a
  -- matched user), but still respect blocks.
  candidates as (
    select p.id, p.created_at, p.role, p.looking_for
    from public.profiles p, viewer v
    where p.id = p_target
      and not public.is_blocked(v.id, p.id)
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
  left join genre_overlap go   on go.profile_id  = c.id;
$$;
