import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MoodBackground } from '@/components/mood-background';
import { ProfileCard, type CardProfile } from '@/components/profile-card';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { MOODS } from '@/constants/design';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { FeedItem } from '@/lib/types';

export default function DiscoverScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session!.user.id;

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, CardProfile>>({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: items, error: feedError } = await supabase.rpc('get_discovery_feed', {
      p_limit: 25,
      p_offset: 0,
    });
    if (feedError) {
      setError(feedError.message);
      setLoading(false);
      return;
    }
    const feedItems = (items ?? []) as FeedItem[];
    if (feedItems.length > 0) {
      const ids = feedItems.map((f) => f.profile_id);
      const { data: profs } = await supabase
        .from('profiles')
        .select('*, profile_tags(tag_options(label, kind)), sound_references(*)')
        .in('id', ids);
      const map: Record<string, CardProfile> = {};
      for (const p of (profs ?? []) as CardProfile[]) map[p.id] = p;
      setProfiles(map);
    }
    setFeed(feedItems);
    setIndex(0);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = feed[index];
  const currentProfile = current ? profiles[current.profile_id] : undefined;

  const swipe = async (direction: 'like' | 'pass') => {
    if (!current) return;
    const target = current.profile_id;
    const targetName = profiles[target]?.display_name ?? 'them';
    setIndex((i) => i + 1);
    const { error: swipeError } = await supabase.from('swipes').insert({
      swiper_id: userId,
      swipee_id: target,
      direction,
    });
    if (swipeError) return;
    if (direction === 'like') {
      const [a, b] = userId < target ? [userId, target] : [target, userId];
      const { data: match } = await supabase
        .from('matches')
        .select('id')
        .eq('user_a', a)
        .eq('user_b', b)
        .maybeSingle();
      if (match) {
        Alert.alert("It's a match!", `You and ${targetName} both want to work together.`, [
          { text: 'Keep browsing' },
          {
            text: 'Open chat',
            onPress: () =>
              router.push({ pathname: '/chat/[matchId]', params: { matchId: match.id } }),
          },
        ]);
      }
    }
  };

  const openMenu = () => {
    if (!current) return;
    const target = current.profile_id;
    const name = profiles[target]?.display_name ?? 'this user';
    Alert.alert(name, undefined, [
      { text: 'Block', style: 'destructive', onPress: () => blockUser(target) },
      { text: 'Report', onPress: () => reportUser(target) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const blockUser = (target: string) => {
    Alert.alert('Block user?', 'You will not see each other anywhere in the app.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('blocks').insert({ blocker_id: userId, blocked_id: target });
          setIndex((i) => i + 1);
        },
      },
    ]);
  };

  const reportUser = (target: string) => {
    const report = async (reason: string) => {
      await supabase.from('reports').insert({
        reporter_id: userId,
        reported_id: target,
        reason,
      });
      Alert.alert('Thanks', "We got your report and we'll take a look.");
    };
    Alert.alert('Report user', 'What is wrong?', [
      { text: 'Spam or fake profile', onPress: () => report('Spam or fake profile') },
      { text: 'Abusive or inappropriate', onPress: () => report('Abusive or inappropriate') },
      { text: 'Something else', onPress: () => report('Other') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <MoodBackground mood="carbon" seed="discovery">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <View style={styles.titleRow}>
          <ThemedText type="subtitle">Discover</ThemedText>
          <Pressable onPress={load} hitSlop={8}>
            <Ionicons name="refresh" size={22} color={MOODS.carbon.accent} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
            <Button title="Retry" variant="secondary" onPress={load} />
          </View>
        ) : current && currentProfile ? (
          <>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.cardScroll}
              showsVerticalScrollIndicator={false}>
              <ProfileCard profile={currentProfile} feedItem={current} onMenu={openMenu} />
            </ScrollView>
            <View style={styles.actions}>
              <Pressable style={[styles.actionButton, styles.pass]} onPress={() => swipe('pass')}>
                <Ionicons name="close" size={32} color="#ffffff" />
              </Pressable>
              <Pressable style={[styles.actionButton, styles.like]} onPress={() => swipe('like')}>
                <Ionicons name="heart" size={30} color="#ffffff" />
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.center}>
            <ThemedText themeColor="textSecondary">No more profiles right now.</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyHint}>
              Check back when more people join, or refresh to see anyone new.
            </ThemedText>
            <Button title="Refresh" variant="secondary" onPress={load} />
          </View>
        )}
      </SafeAreaView>
    </MoodBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },
  safe: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  scroll: {
    // Must take the space between the title and the action row so the card
    // scrolls internally and the Like/Pass buttons stay pinned + tappable.
    // Without flex:1 a tall card pushes the buttons off-screen.
    flex: 1,
  },
  cardScroll: {
    padding: Spacing.three,
    paddingBottom: Spacing.two,
    flexGrow: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.five,
    paddingVertical: Spacing.three,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pass: {
    backgroundColor: '#8b8d98',
  },
  like: {
    backgroundColor: '#e5484d',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  emptyHint: {
    textAlign: 'center',
  },
  error: {
    color: '#e5484d',
    textAlign: 'center',
  },
});
