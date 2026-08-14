import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { MoodScreen } from '@/components/mood-background';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { searchSpotify } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { attachReference, removeReference } from '@/lib/references';
import { supabase } from '@/lib/supabase';
import type { SoundReference, SpotifySearchResult } from '@/lib/types';

export default function ReferencesScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const editing = from === 'profile';
  const { session, refreshProfile } = useAuth();
  const userId = session!.user.id;
  const theme = useTheme();

  const [refType, setRefType] = useState<'artist' | 'track'>('artist');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [refs, setRefs] = useState<SoundReference[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadRefs = useCallback(async () => {
    const { data } = await supabase
      .from('sound_references')
      .select('*')
      .eq('profile_id', userId)
      .order('created_at');
    setRefs((data ?? []) as SoundReference[]);
  }, [userId]);

  useEffect(() => {
    loadRefs();
  }, [loadRefs]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        setResults(await searchSpotify(q, refType));
        setError(null);
      } catch {
        setError("Couldn't reach search right now. Try again in a moment.");
      }
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [query, refType]);

  const attach = async (r: SpotifySearchResult) => {
    try {
      await attachReference(userId, r);
      await loadRefs();
    } catch {
      setError('Could not add that reference.');
    }
  };

  const remove = async (id: string) => {
    await removeReference(id);
    await loadRefs();
  };

  const finish = async () => {
    if (editing) {
      router.back();
      return;
    }
    // Onboarding continues to the optional artist-link step, which is what
    // marks the profile onboarded.
    router.push('/onboarding/artist');
  };

  const attachedIds = new Set(refs.map((r) => r.spotify_id));

  return (
    <MoodScreen mood="dusk" seed="onboarding">
      <ThemedText type="subtitle">Sound references</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {editing ? '' : 'Step 3 of 4. Optional. '}
        Tag the artists or tracks you sound like. The more you add, the better
        your matches.
      </ThemedText>

      <View style={styles.toggle}>
        <Chip
          label="Artists"
          selected={refType === 'artist'}
          onPress={() => setRefType('artist')}
        />
        <Chip
          label="Tracks"
          selected={refType === 'track'}
          onPress={() => setRefType('track')}
        />
      </View>

      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder={refType === 'artist' ? 'Search artists on Spotify' : 'Search tracks on Spotify'}
        autoCapitalize="none"
      />

      {error ? <ThemedText type="small" style={styles.error}>{error}</ThemedText> : null}
      {searching ? <ActivityIndicator /> : null}

      {results
        .filter((r) => !attachedIds.has(r.spotifyId))
        .map((r) => (
          <Pressable key={`${r.refType}:${r.spotifyId}`} onPress={() => attach(r)}>
            <ThemedView type="backgroundElement" style={styles.row}>
              {r.imageUrl ? (
                <Image source={{ uri: r.imageUrl }} style={styles.art} />
              ) : (
                <View style={[styles.art, { backgroundColor: theme.backgroundSelected }]} />
              )}
              <View style={styles.rowText}>
                <ThemedText numberOfLines={1}>{r.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {r.refType === 'track' ? r.artistName ?? 'Track' : 'Artist'}
                </ThemedText>
              </View>
              <Ionicons name="add-circle-outline" size={24} color={theme.textSecondary} />
            </ThemedView>
          </Pressable>
        ))}

      {refs.length > 0 ? (
        <View style={styles.group}>
          <ThemedText type="smallBold">Your references</ThemedText>
          {refs.map((r) => (
            <ThemedView key={r.id} type="backgroundElement" style={styles.row}>
              {r.image_url ? (
                <Image source={{ uri: r.image_url }} style={styles.art} />
              ) : (
                <View style={[styles.art, { backgroundColor: theme.backgroundSelected }]} />
              )}
              <View style={styles.rowText}>
                <ThemedText numberOfLines={1}>{r.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {r.ref_type === 'track' ? r.artist_name ?? 'Track' : 'Artist'}
                </ThemedText>
              </View>
              <Pressable onPress={() => remove(r.id)} hitSlop={8}>
                <Ionicons name="close-circle-outline" size={24} color={theme.textSecondary} />
              </Pressable>
            </ThemedView>
          ))}
        </View>
      ) : null}

      <Button
        title={editing ? 'Done' : refs.length > 0 ? 'Continue' : 'Skip for now'}
        onPress={finish}
      />
    </MoodScreen>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: 12,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  art: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  group: {
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  error: {
    color: '#e5484d',
  },
});
