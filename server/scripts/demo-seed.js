// Seeds two clearly-labelled demo accounts so the discovery feed and match
// flow have content during manual testing. Re-runnable: recreates the demo
// users from scratch each time. Run from server/: node scripts/demo-seed.js
//
// Sign in as either with password: demo-pass-1234

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { searchArtists } from '../src/spotify.js';

const PASSWORD = 'demo-pass-1234';

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function ensureUser({ email, profile, tagIds, artistQuery }) {
  const { data: users, error: listError } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listError) throw listError;
  const existing = users.users.find((u) => u.email === email);
  if (existing) await admin.auth.admin.deleteUser(existing.id);

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  const id = data.user.id;

  const { error: profileError } = await admin
    .from('profiles')
    .update({ ...profile, onboarded: true })
    .eq('id', id);
  if (profileError) throw profileError;

  if (tagIds.length > 0) {
    const { error: tagError } = await admin
      .from('profile_tags')
      .insert(tagIds.map((tag_id) => ({ profile_id: id, tag_id })));
    if (tagError) throw tagError;
  }

  if (artistQuery) {
    const [artist] = await searchArtists(artistQuery);
    if (artist) {
      const { error: refError } = await admin.from('sound_references').insert({
        profile_id: id,
        ref_type: 'artist',
        spotify_id: artist.spotifyId,
        name: artist.name,
        image_url: artist.imageUrl,
        genres: artist.genres,
      });
      if (refError) throw refError;
      console.log(`  ref: ${artist.name} (${artist.spotifyId})`);
    }
  }

  console.log(`${email} → ${id}`);
  return id;
}

await ensureUser({
  email: 'demo-producer@demo.local',
  profile: {
    display_name: 'Marto Beats',
    role: 'producer',
    looking_for: ['vocalist'],
    bio: 'Dublin boom bap producer. Demo account for testing.',
    location: 'Dublin',
    soundcloud_url: 'https://soundcloud.com/discover',
  },
  tagIds: ['hip-hop', 'boom-bap', 'irish-rap'],
  artistQuery: 'Mobb Deep',
});

await ensureUser({
  email: 'demo-vocalist@demo.local',
  profile: {
    display_name: 'Aoife Vocals',
    role: 'vocalist',
    looking_for: ['producer'],
    bio: '90s-leaning hooks and toplines. Demo account for testing.',
    location: 'Cork',
  },
  tagIds: ['hip-hop', 'boom-bap'],
  artistQuery: 'Nas',
});

console.log('Demo seed complete.');
