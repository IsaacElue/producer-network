import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { MoodScreen } from '@/components/mood-background';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getArtist, searchSpotify } from '@/lib/api';
import { linkArtist, unlinkArtist } from '@/lib/artist';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { SpotifySearchResult } from '@/lib/types';

export default function ArtistLinkScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const editing = from === 'profile';
  const { session, profile, refreshProfile } = useAuth();
  const userId = session!.user.id;
  const theme = useTheme();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifySearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const linkedId = profile?.spotify_artist_id ?? null;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        setResults(await searchSpotify(q, 'artist'));
        setError(null);
      } catch {
        setError("Couldn't reach search right now. Try again in a moment.");
      }
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const link = async (r: SpotifySearchResult) => {
    setLinking(true);
    setError(null);
    try {
      const detail = await getArtist(r.spotifyId);
      await linkArtist(userId, detail);
      await refreshProfile();
      setQuery('');
      setResults([]);
    } catch {
      setError('Could not link that artist.');
    }
    setLinking(false);
  };

  const unlink = async () => {
    await unlinkArtist(userId);
    await refreshProfile();
  };

  const finish = async () => {
    if (editing) {
      router.back();
      return;
    }
    setFinishing(true);
    await supabase.from('profiles').update({ onboarded: true }).eq('id', userId);
    await refreshProfile();
    router.replace('/');
  };

  return (
    <MoodScreen mood="dusk" seed="onboarding">
      <ThemedText type="subtitle">Are you on Spotify?</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {editing ? '' : 'Last step, optional. '}
        If you release music, link your Spotify artist page so collaborators can
        hear it. This is your own music, not the artists you sound like.
      </ThemedText>

      {linkedId ? (
        <ThemedView type="backgroundElement" style={styles.linkedCard}>
          {profile?.spotify_artist_image_url ? (
            <Image source={{ uri: profile.spotify_artist_image_url }} style={styles.linkedArt} />
          ) : (
            <View style={[styles.linkedArt, { backgroundColor: theme.backgroundSelected }]} />
          )}
          <View style={styles.linkedText}>
            <ThemedText type="small" themeColor="textSecondary">
              Linked artist
            </ThemedText>
            <ThemedText numberOfLines={1}>{profile?.spotify_artist_name}</ThemedText>
            {profile?.spotify_artist_url ? (
              <Pressable onPress={() => Linking.openURL(profile.spotify_artist_url as string)}>
                <ThemedText type="linkPrimary">Open in Spotify</ThemedText>
              </Pressable>
            ) : null}
          </View>
          <Pressable onPress={unlink} hitSlop={8}>
            <Ionicons name="close-circle-outline" size={24} color={theme.textSecondary} />
          </Pressable>
        </ThemedView>
      ) : (
        <>
          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder="Search for your artist name on Spotify"
            autoCapitalize="none"
          />
          {error ? <ThemedText type="small" style={styles.error}>{error}</ThemedText> : null}
          {searching || linking ? <ActivityIndicator /> : null}
          {results.map((r) => (
            <Pressable key={r.spotifyId} onPress={() => link(r)} disabled={linking}>
              <ThemedView type="backgroundElement" style={styles.row}>
                {r.imageUrl ? (
                  <Image source={{ uri: r.imageUrl }} style={styles.art} />
                ) : (
                  <View style={[styles.art, { backgroundColor: theme.backgroundSelected }]} />
                )}
                <View style={styles.rowText}>
                  <ThemedText numberOfLines={1}>{r.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Tap if this is you
                  </ThemedText>
                </View>
                <Ionicons name="add-circle-outline" size={24} color={theme.textSecondary} />
              </ThemedView>
            </Pressable>
          ))}
        </>
      )}

      <Button
        title={editing ? 'Done' : linkedId ? 'Finish' : 'Skip for now'}
        onPress={finish}
        loading={finishing}
      />
    </MoodScreen>
  );
}

const styles = StyleSheet.create({
  linkedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 12,
  },
  linkedArt: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  linkedText: {
    flex: 1,
    gap: 2,
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
  error: {
    color: '#e5484d',
  },
});
