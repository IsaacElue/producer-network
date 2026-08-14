import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MoodBackground } from '@/components/mood-background';
import { ThemedText } from '@/components/themed-text';
import { MOODS } from '@/constants/design';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { MatchRow, MessageRow, Profile } from '@/lib/types';

const M = MOODS.sand;

export default function ChatScreen() {
  const router = useRouter();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { session } = useAuth();
  const userId = session!.user.id;

  const [other, setOther] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<MessageRow>>(null);

  const load = useCallback(async () => {
    const { data: match } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .maybeSingle();
    if (!match) {
      setLoading(false);
      return;
    }
    const matchRow = match as MatchRow;
    const otherId = matchRow.user_a === userId ? matchRow.user_b : matchRow.user_a;
    const [{ data: prof }, { data: msgs }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', otherId).maybeSingle(),
      supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true }),
    ]);
    setOther((prof as Profile) ?? null);
    setMessages((msgs ?? []) as MessageRow[]);
    setLoading(false);
  }, [matchId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const incoming = payload.new as MessageRow;
          setMessages((prev) =>
            prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming],
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  const send = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    const { data, error } = await supabase
      .from('messages')
      .insert({ match_id: matchId, sender_id: userId, content })
      .select()
      .single();
    if (error) {
      Alert.alert('Could not send', 'This conversation may no longer be available.');
    } else {
      setDraft('');
      const sent = data as MessageRow;
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
    }
    setSending(false);
  };

  const deleteConversation = () => {
    Alert.alert(
      'Delete conversation?',
      'This removes the match and deletes the conversation for both of you. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Deleting the match cascades its messages (messages.match_id ON
            // DELETE CASCADE); RLS lets a match member delete their own match.
            const { error } = await supabase.from('matches').delete().eq('id', matchId);
            if (error) {
              Alert.alert('Could not delete', 'Please try again.');
              return;
            }
            router.back();
          },
        },
      ],
    );
  };

  const openMenu = () => {
    if (!other) return;
    const otherId = other.id;
    Alert.alert(other.display_name, undefined, [
      {
        text: 'View profile',
        onPress: () => router.push({ pathname: '/profile/[id]', params: { id: otherId } }),
      },
      {
        text: 'Delete conversation',
        style: 'destructive',
        onPress: deleteConversation,
      },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Block user?', 'You will not see each other anywhere in the app.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Block',
              style: 'destructive',
              onPress: async () => {
                await supabase.from('blocks').insert({ blocker_id: userId, blocked_id: otherId });
                router.back();
              },
            },
          ]),
      },
      {
        text: 'Report',
        onPress: async () => {
          await supabase.from('reports').insert({
            reporter_id: userId,
            reported_id: otherId,
            reason: 'Reported from chat',
          });
          Alert.alert('Thanks', "We got your report and we'll take a look.");
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <MoodBackground mood={M} seed={`chat-${matchId}`}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: other?.display_name ?? 'Chat',
          headerStyle: { backgroundColor: M.gradient[0] },
          headerTintColor: M.ink,
          headerTitleStyle: { color: M.ink },
          headerShadowVisible: false,
          headerRight: () => (
            <Pressable onPress={openMenu} hitSlop={8}>
              <Ionicons name="ellipsis-horizontal" size={22} color={M.ink} />
            </Pressable>
          ),
        }}
      />
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={styles.list}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item }) => {
                const mine = item.sender_id === userId;
                return (
                  <View style={[styles.bubbleRow, mine ? styles.mineRow : styles.theirsRow]}>
                    <View
                      style={[
                        styles.bubble,
                        mine ? styles.mineBubble : styles.theirsBubble,
                      ]}>
                      <ThemedText style={mine ? styles.mineText : styles.theirsText}>
                        {item.content}
                      </ThemedText>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.center}>
                  <ThemedText type="small" themeColor="textSecondary">
                    You matched. Say hello and share what you're working on.
                  </ThemedText>
                </View>
              }
            />
          )}
          <View style={[styles.inputRow, { borderTopColor: M.hairline }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message"
              placeholderTextColor={M.faint}
              style={[styles.input, { color: M.ink }]}
              multiline
            />
            <Pressable
              onPress={send}
              disabled={!draft.trim() || sending}
              style={[styles.send, { opacity: !draft.trim() || sending ? 0.4 : 1 }]}>
              <Ionicons name="arrow-up" size={22} color="#F4EDDF" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
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
  },
  fill: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  list: {
    padding: Spacing.three,
    gap: Spacing.two,
    flexGrow: 1,
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  mineRow: {
    justifyContent: 'flex-end',
  },
  theirsRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  mineBubble: {
    backgroundColor: M.accent,
  },
  mineText: {
    color: '#F7F0E4',
  },
  theirsBubble: {
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  theirsText: {
    color: M.ink,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    padding: Spacing.three,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
    maxHeight: 120,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: M.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
