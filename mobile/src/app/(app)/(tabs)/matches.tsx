import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MoodBackground } from '@/components/mood-background';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MOODS } from '@/constants/design';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { ROLE_LABELS, type MatchRow, type MessageRow, type Profile } from '@/lib/types';

type MatchListItem = {
  match: MatchRow;
  other: Profile;
  lastMessage: MessageRow | null;
};

export default function MatchesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session!.user.id;

  const [items, setItems] = useState<MatchListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order('created_at', { ascending: false });
    const matchRows = (matches ?? []) as MatchRow[];
    if (matchRows.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const otherIds = matchRows.map((m) => (m.user_a === userId ? m.user_b : m.user_a));
    const matchIds = matchRows.map((m) => m.id);
    const [{ data: profs }, { data: blocks }, { data: msgs }] = await Promise.all([
      supabase.from('profiles').select('*').in('id', otherIds),
      supabase.from('blocks').select('blocked_id').eq('blocker_id', userId),
      supabase
        .from('messages')
        .select('*')
        .in('match_id', matchIds)
        .order('created_at', { ascending: false }),
    ]);

    const profileById = new Map(((profs ?? []) as Profile[]).map((p) => [p.id, p]));
    const blocked = new Set((blocks ?? []).map((b) => b.blocked_id as string));
    const lastByMatch = new Map<string, MessageRow>();
    for (const m of (msgs ?? []) as MessageRow[]) {
      if (!lastByMatch.has(m.match_id)) lastByMatch.set(m.match_id, m);
    }

    setItems(
      matchRows.flatMap((match) => {
        const otherId = match.user_a === userId ? match.user_b : match.user_a;
        const other = profileById.get(otherId);
        if (!other || blocked.has(otherId)) return [];
        return [{ match, other, lastMessage: lastByMatch.get(match.id) ?? null }];
      }),
    );
    setLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <MoodBackground mood="sand" seed="matches">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <ThemedText type="subtitle" style={styles.title}>
          Matches
        </ThemedText>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <ThemedText themeColor="textSecondary">No matches yet.</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              When you and someone else both tap like, they show up here.
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.match.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/chat/[matchId]',
                    params: { matchId: item.match.id },
                  })
                }>
                <ThemedView type="backgroundElement" style={styles.row}>
                  <View style={styles.avatar}>
                    <ThemedText type="smallBold" style={styles.avatarText}>
                      {item.other.display_name.slice(0, 1).toUpperCase() || '?'}
                    </ThemedText>
                  </View>
                  <View style={styles.rowText}>
                    <ThemedText numberOfLines={1}>{item.other.display_name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {item.lastMessage
                        ? `${item.lastMessage.sender_id === userId ? 'You: ' : ''}${item.lastMessage.content}`
                        : item.other.role
                          ? `${ROLE_LABELS[item.other.role]} · say hello`
                          : 'Say hello'}
                    </ThemedText>
                  </View>
                </ThemedView>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </MoodBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  list: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 12,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: MOODS.sand.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#F4EDDF' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  hint: {
    textAlign: 'center',
  },
});
