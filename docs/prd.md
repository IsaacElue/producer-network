# Producer Network — Concept, Positioning & Build Scope

## 1. The Problem

Producers who want to grow their network and find collaborators today are stuck choosing between:

- **Instagram/DMs** — the default, but unreliable. Most people don't reply to cold DMs, and building a network this way requires being naturally social and visible, which not everyone is (including Isaac, who identifies as more "faceless" than a natural networker).
- **Existing networking apps (Vampr, MuseLink, KollabMe, ProCollabs)** — real products, real user bases (Vampr has 1M+ users), but they match on broad genre tags: hip hop, R&B, pop, etc. A direct user review of Vampr states: "If you specialize in any sort of sub-genre, this app is essentially useless to you." That's the exact gap this concept targets.
- **BeatStars** — not a networking tool at all, it's a beat marketplace (buying/selling beats/licenses). Different category entirely.

The real problem: modern production is extremely sub-genre-specific, but every existing tool flattens this down to broad categories that don't capture what people actually sound like.

## 2. The Wedge / Differentiator

**Match by reference, not by category.**

Instead of picking from a fixed genre dropdown, users tag themselves and their searches against real, specific, existing songs and artists (pulled live from Spotify's public catalog via API). This means:

- The "genre list" is infinite and always current — it's just whatever real music exists, not a taxonomy someone had to guess and build in advance.
- Totally obscure, hyper-niche, or emerging sub-genres are searchable from day one, because they're just artist/track lookups, not pre-defined categories the app's team had to anticipate.
- A user can express nuance no dropdown could ever capture: "I make beats like [specific song] by [specific artist], but with more of [another artist]'s low-end" — represented as multiple reference tags, not one genre label.

This directly solves the exact complaint users have about Vampr, and does something none of the current players (Vampr, MuseLink, KollabMe, ProCollabs) do.

## 3. What This Is (and Isn't)

**It is:** a networking / discovery platform centered on producers — producer-to-producer, producer-to-vocalist, producer-to-engineer — to find collaborators based on specific sound reference, and connect to actually make music together. Matching by sound reference is a feature of the platform, not the entire value prop — the core value is centralizing producer discovery/networking in one dedicated place instead of relying on Instagram DMs, where reply rates and intent are both uncertain.

**Explicitly not:** a general multi-sided network for every music-industry role (vocalist-to-engineer, musician-to-musician, etc.). This is scoped to "producers to something," not "everyone in music." Musicians/vocalists may join later specifically to find beats and connect with producers (a natural, optional expansion), but broadening to "everyone in music" is an explicit future consideration, not the current goal.

**It is not:**
- A marketplace (no buying/selling beats or licenses — that's BeatStars' lane)
- A distribution or publishing tool (a Vampr feature that reportedly caused real user complaints — avoid replicating)
- A DAW or audio tool — no in-app music creation
- Limited to any one genre — the reference-based tagging is genre-agnostic by design; it just happens to solve a real gap first felt in niche hip hop/rap scenes

**Shape, in one line:** Instagram's social/profile feel + Spotify's live artist/track data for tagging and search + Vampr/Tinder's swipe-to-connect mechanic, with sub-genre-level precision none of them currently have.

## 4. Core User Loop

1. User creates a profile: role (producer, vocalist, engineer, etc.), a "looking for" role (who they want to connect with), and external links (Instagram, TikTok, SoundCloud, YouTube) — pasted links to existing tracks/pages, not uploaded audio files. Click a link, listen on the source platform, come back and network. No in-app audio hosting/storage — keeps this a pure networking layer, not a content platform, and avoids storage/bandwidth costs entirely.
2. User tags their sound **progressively, broad to niche** — not a blank Spotify search as the first action:
   - Step 1: pick a broad genre (hip hop, R&B, pop, etc.) — familiar, tag-picker UX, no blank page
   - Step 2: narrow to sub-genre/scene (trap, Atlanta sound, DMV, UK drill, Irish rap, SA underground/SoundCloud rap, etc.)
   - Step 3 (optional, for users who want max precision): add specific artist/track references via Spotify search — "I sound like [artist/song]" — can add multiple
   - This keeps onboarding familiar at the entry point while still enabling the sub-genre/reference-level precision that's the actual differentiator
3. User can also post what they're looking for: "Looking for a vocalist who sounds like [artist/song] for this track"
4. Discovery/swipe feed surfaces other users whose tagged references overlap or are sonically adjacent (via Spotify's audio-feature data — tempo, energy, key, mood — as a secondary matching signal beyond just shared artist tags)
5. Mutual interest opens a chat, collaboration happens off-platform (DM, then wherever — Instagram, WhatsApp, actual studio session), users optionally post the result back on their profile ("worked with X, here's what we made")
6. Over time, a user's own posted collabs become part of their own discoverable "sound profile" too — the network becomes self-reinforcing

## 5. Positioning / Go-to-Market

- **Not global from day one.** Start hyper-focused on one underserved scene: Irish hip hop/rap. Large players like Vampr are too broad and diluted to deliver good matches in smaller or niche scenes, and Ireland specifically has a thin hip hop/rap producer pool relative to the US/UK — meaning existing tools feel especially useless here, exactly the gap worth exploiting first.
- Location is **not a filtering mechanic in the product** (you don't have to be in the same place to collaborate on music) — it's purely a go-to-market sequencing choice. Launch and seed density in Ireland, then expand to UK, then US/other scenes once the core loop is proven.
- Early growth plan: Isaac uses it himself as a real producer building his own network (dogfooding, same as the beats/networking plan already underway), seeds it with his existing circle, and expands scene by scene rather than trying to be global immediately.

## 6. Technical Shape

### 6.1 Sound tagging via Spotify Web API
- Use Spotify's public Web API for artist/track search (Client Credentials flow — no user Spotify login needed) — any artist or track in Spotify's catalog is searchable live, not limited to famous names, and requires no pre-built database of genres or artists on our side
- Note: Spotify deprecated the `/audio-features` endpoint for apps created after Nov 2024, and tightened search (batch artist lookup removed, search limit capped at 10) as of Feb 2026 — audio-feature-based matching (tempo/key/energy) is not available and is not part of this design
- Matching signal is genre-array + reference overlap instead: broad genre tag, sub-genre tag, exact artist/track reference, and artists snapshotted from Spotify's genre field at tag time

### 6.2 Matching/scoring model (tiered)
1. **Exact artist/track reference overlap** — highest weight
2. **Similar-artist overlap** — via Last.fm's `artist.getSimilar` API (free, no approval wait) — mid-tier weight, critical for cold-start since exact-reference overlap will be near-zero in a small seed network
3. **Shared broad genre/sub-genre tag** — fallback weight
4. **Role complementarity** — mutual match between a user's `role` and the other's `looking_for` (producer wants vocalist, vocalist wants producer, etc.) — factored in alongside sound-match signals, not a separate system
- Links to a user's actual music (Instagram/TikTok/SoundCloud) serve as social proof/showcase, not as matching input — no in-app audio hosting or analysis

### 6.3 Suggested stack
- **Frontend:** React Native (Expo) — ship to iOS and Android from one codebase, cloud builds mean no Mac dependency
- **Backend:** Node.js or Python API layer, handles Spotify API calls (search, audio features) and matching logic
- **Database:** Supabase (Postgres) — user profiles, reference tags, connections/matches, chat messages
- **Auth:** Supabase Auth or a simple email/social login — single low-cost option
- **Spotify integration:** Spotify Web API (Client Credentials flow is enough for searching public catalog data — no need for users to log in with their own Spotify accounts for MVP)
- **Hosting cost target:** near-zero — Supabase free tier + Expo + a small serverless backend (Vercel/Railway free or near-free tier) should comfortably cover MVP usage at small scale

### 6.4 MVP feature scope (build this first)
1. Profile creation: name, role, bio, external links (Instagram/TikTok/SoundCloud)
2. Spotify search integration: add one or more "I sound like" reference tags to a profile
3. Simple discovery feed: browse/swipe other profiles, filtered by reference-tag overlap and audio-feature similarity
4. Mutual match creates a basic chat/connection
5. Manual launch scope: seed with Isaac's own network first (Irish producers/vocalists he already knows or can reach), no need for automated growth features yet

### 6.5 Phase 2 (after MVP validates the loop)
1. "Looking for" posts (separate from static profile tags) — e.g. "need a vocalist who sounds like X for a track this week"
2. Better matching algorithm weighting (shared exact artist > shared audio-feature profile > shared broad genre as fallback)
3. Location as an optional display/filter field (not a hard requirement) once expanding beyond the initial Irish scene
4. Posting actual collaboration outcomes to profiles ("made this track with X")

### 6.6 Explicit non-goals for now
- No beat/license marketplace functionality
- No music distribution or publishing features (avoid replicating the parts of Vampr that generated real user complaints)
- No in-app audio upload/hosting/storage — links out to existing platforms only
- No monetization/payment features in MVP — prove the network loop works first

### 6.7 Monetization direction (not MVP, but decided in principle)
- Core networking loop (profile, tagging, discovery, matching, chat) stays free — this is what proves the loop works and drives adoption
- Future premium layer: unlimited swipes, boosted profile visibility, "see who referenced your sound," possibly a direct line to Isaac as platform owner for select opportunities
- Decided now specifically so free-tier expectations don't get baked in and then broken later

### 6.8 Defensibility / moat
- The reference-tagging mechanic itself (Spotify search + genre matching) is not hard tech and could be copied by an incumbent (Vampr, MuseLink) relatively quickly if this gets traction
- Real moat is scene ownership, not technology: starting hyper-focused on the Irish/UK hip hop-rap producer scene means owning the actual relationships and density in that specific pool before expanding — a competitor can copy the feature but can't instantly replicate an owned scene

## 7. Why This Fits Isaac Specifically

- Solves his own stated real problem: being a relatively "faceless," non-natural-networker producer trying to build a network and find collaborators in a country (Ireland) with a thin hip hop/rap scene
- Zero cash outlay to start (aside from eventual ~99 USD/year Apple Developer + ~25 USD one-time Google Play fee) — fits his current no-capital-risk constraint, same shape as the beats/networking plan already locked in
- Directly complementary to, not competing with, his existing "make beats, build network, upload consistently" plan — this tool would be something he uses himself to execute that plan, not a separate unrelated venture
- Plays to his real strengths: CS/software background for the build, product instinct for spotting the genre-tag-depth gap competitors miss

## 8. Success Criteria

MVP is successful if Isaac and a real seed group of Irish producers/vocalists he knows actually use it to find and start at least one genuine collaboration that wouldn't have happened through Instagram DMs alone. Ship fast, use it for real, let actual usage (not further ideation) drive what gets built next.
