-- Producer Network — row level security
-- Everything is deny-by-default; the policies below are the whole surface.

alter table public.profiles         enable row level security;
alter table public.tag_options      enable row level security;
alter table public.profile_tags     enable row level security;
alter table public.sound_references enable row level security;
alter table public.similar_artists  enable row level security;
alter table public.swipes           enable row level security;
alter table public.matches          enable row level security;
alter table public.messages         enable row level security;
alter table public.blocks           enable row level security;
alter table public.reports          enable row level security;

-- Blocks must be checked across users (a block in either direction hides
-- both people from each other), but blocks RLS only lets you see your own
-- rows — so cross-user checks go through this security-definer helper.
create or replace function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

-- profiles: readable by any signed-in user (discovery needs it); only the
-- owner can update. No insert/delete policies — rows are created by the
-- signup trigger and removed by the auth.users cascade.
create policy "profiles: authenticated can read"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles: owner can update"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- tag_options: the taxonomy is read-only reference data; rows are seeded
-- with SQL (service role), so no write policies exist.
create policy "tag_options: authenticated can read"
  on public.tag_options for select
  to authenticated
  using (true);

-- profile_tags: readable by any signed-in user; owner manages their own.
create policy "profile_tags: authenticated can read"
  on public.profile_tags for select
  to authenticated
  using (true);

create policy "profile_tags: owner can insert"
  on public.profile_tags for insert
  to authenticated
  with check ((select auth.uid()) = profile_id);

create policy "profile_tags: owner can delete"
  on public.profile_tags for delete
  to authenticated
  using ((select auth.uid()) = profile_id);

-- similar_artists: readable cache; written only by the server via the
-- service role (which bypasses RLS), so no write policies exist.
create policy "similar_artists: authenticated can read"
  on public.similar_artists for select
  to authenticated
  using (true);

-- sound_references: readable by any signed-in user; owner manages their own.
create policy "sound_references: authenticated can read"
  on public.sound_references for select
  to authenticated
  using (true);

create policy "sound_references: owner can insert"
  on public.sound_references for insert
  to authenticated
  with check ((select auth.uid()) = profile_id);

create policy "sound_references: owner can delete"
  on public.sound_references for delete
  to authenticated
  using ((select auth.uid()) = profile_id);

-- swipes: you can create your own and read only your own. Nobody can read
-- swipes aimed at them, so likes stay private until they become a match.
create policy "swipes: owner can insert"
  on public.swipes for insert
  to authenticated
  with check ((select auth.uid()) = swiper_id);

create policy "swipes: owner can read own"
  on public.swipes for select
  to authenticated
  using ((select auth.uid()) = swiper_id);

-- matches: visible only to the two members. No insert/update/delete
-- policies — matches are created solely by the security-definer swipe trigger.
create policy "matches: members can read"
  on public.matches for select
  to authenticated
  using ((select auth.uid()) in (user_a, user_b));

-- messages: only members of the parent match can read or write, and you
-- can only send as yourself.
create policy "messages: match members can read"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and (select auth.uid()) in (m.user_a, m.user_b)
    )
  );

create policy "messages: match members can send as self"
  on public.messages for insert
  to authenticated
  with check (
    (select auth.uid()) = sender_id
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and (select auth.uid()) in (m.user_a, m.user_b)
        and not public.is_blocked(m.user_a, m.user_b)
    )
  );

-- blocks: you manage your own block list; nobody can see who blocked them.
create policy "blocks: owner can insert"
  on public.blocks for insert
  to authenticated
  with check ((select auth.uid()) = blocker_id);

create policy "blocks: owner can read own"
  on public.blocks for select
  to authenticated
  using ((select auth.uid()) = blocker_id);

create policy "blocks: owner can delete own"
  on public.blocks for delete
  to authenticated
  using ((select auth.uid()) = blocker_id);

-- reports: write-only from the app (reviewed in the Supabase dashboard).
create policy "reports: reporter can insert"
  on public.reports for insert
  to authenticated
  with check ((select auth.uid()) = reporter_id);
