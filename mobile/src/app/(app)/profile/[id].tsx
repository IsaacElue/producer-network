import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ProfileCard, type CardProfile } from '@/components/profile-card';
import { ThemedText } from '@/components/themed-text';
import { MoodScreen } from '@/components/mood-background';
import { supabase } from '@/lib/supabase';
import type { FeedItem } from '@/lib/types';

// Read-only profile view opened from a chat thread. Uses the exact same
// ProfileCard as Discover, and get_profile_card() supplies the same
// match-signal ("why you match") data for an already-matched user.
export default function ProfileViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<CardProfile | null>(null);
  const [feedItem, setFeedItem] = useState<FeedItem | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: prof }, { data: card }] = await Promise.all([
      supabase
        .from('profiles')
        .select('*, profile_tags(tag_options(label, kind)), sound_references(*)')
        .eq('id', id)
        .maybeSingle(),
      supabase.rpc('get_profile_card', { p_target: id }),
    ]);
    setProfile((prof as CardProfile) ?? null);
    setFeedItem(((card ?? [])[0] as FeedItem) ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: profile?.display_name ?? 'Profile' }} />
      {loading ? (
        <MoodScreen mood="ember" seed={id ?? 'profile'} scroll={false}>
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        </MoodScreen>
      ) : !profile ? (
        <MoodScreen mood="ember" seed={id ?? 'profile'}>
          <ThemedText themeColor="textSecondary">This profile is no longer available.</ThemedText>
        </MoodScreen>
      ) : (
        <MoodScreen mood="ember" seed={id ?? 'profile'}>
          <ProfileCard
            profile={profile}
            feedItem={
              feedItem ?? {
                profile_id: profile.id,
                score: 0,
                shared_artist_names: [],
                shared_track_names: [],
                similar_artist_names: [],
                shared_tag_labels: [],
                role_match: 'none',
              }
            }
          />
        </MoodScreen>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
