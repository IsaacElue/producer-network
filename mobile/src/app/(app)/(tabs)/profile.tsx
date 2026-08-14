import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { MoodScreen } from '@/components/mood-background';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deleteAccount } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { ROLE_LABELS, type SoundReference } from '@/lib/types';

type OwnTag = { tag_options: { label: string } | null };

export default function ProfileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { session, profile, refreshProfile } = useAuth();
  const userId = session!.user.id;

  const [tags, setTags] = useState<string[]>([]);
  const [refs, setRefs] = useState<SoundReference[]>([]);
  const [deleting, setDeleting] = useState(false);

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      "This permanently deletes your profile, references, matches and messages. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              // The auth user is already gone, so the revoke call may fail —
              // clearing the local session is what matters, so don't let its
              // failure surface as a deletion error.
              await supabase.auth.signOut().catch(() => {});
            } catch {
              setDeleting(false);
              Alert.alert('Could not delete account', 'Something went wrong. Please try again.');
            }
          },
        },
      ],
    );
  };

  useFocusEffect(
    useCallback(() => {
      refreshProfile();
      (async () => {
        const [{ data: myTags }, { data: myRefs }] = await Promise.all([
          supabase.from('profile_tags').select('tag_options(label)').eq('profile_id', userId),
          supabase
            .from('sound_references')
            .select('*')
            .eq('profile_id', userId)
            .order('created_at'),
        ]);
        // supabase-js can't infer that the tag_options join is to-one, so it
        // types it as an array; at runtime it's an object.
        setTags(
          ((myTags ?? []) as unknown as OwnTag[])
            .map((t) => t.tag_options?.label)
            .filter((l): l is string => Boolean(l)),
        );
        setRefs((myRefs ?? []) as SoundReference[]);
      })();
    }, [userId, refreshProfile]),
  );

  if (!profile) return null;

  return (
    <MoodScreen mood="ember" seed="profile">
      <ThemedText type="subtitle">{profile.display_name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {profile.role ? ROLE_LABELS[profile.role] : 'No role set'}
        {profile.looking_for.length > 0
          ? ` · looking for ${profile.looking_for.map((r) => ROLE_LABELS[r].toLowerCase()).join(', ')}`
          : ''}
        {profile.location ? ` · ${profile.location}` : ''}
      </ThemedText>

      {profile.bio ? <ThemedText>{profile.bio}</ThemedText> : null}

      {tags.length > 0 ? (
        <View style={styles.section}>
          <ThemedText type="smallBold">Genres & scenes</ThemedText>
          <View style={styles.chips}>
            {tags.map((label) => (
              <Chip key={label} label={label} />
            ))}
          </View>
        </View>
      ) : null}

      {refs.length > 0 ? (
        <View style={styles.section}>
          <ThemedText type="smallBold">Sounds like</ThemedText>
          {refs.map((r) => (
            <ThemedText key={r.id} type="small" themeColor="textSecondary">
              {r.name}
              {r.ref_type === 'track' && r.artist_name ? ` by ${r.artist_name}` : ''}
            </ThemedText>
          ))}
        </View>
      ) : null}

      {/* TEMPORARY: preview the immersive spotlight view of your own profile.
          Remove once the real Discover-card entry is wired. */}
      <View style={styles.buttons}>
        <Button
          title="Preview spotlight view (temp)"
          onPress={() => router.push({ pathname: '/spotlight/[id]', params: { id: userId } })}
        />
        <Button
          title="Edit profile"
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/onboarding/profile', params: { from: 'profile' } })
          }
        />
        <Button
          title="Edit genres & scenes"
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/onboarding/tags', params: { from: 'profile' } })
          }
        />
        <Button
          title="Edit sound references"
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/onboarding/references', params: { from: 'profile' } })
          }
        />
        <Button
          title={profile.spotify_artist_id ? 'Your Spotify artist' : 'Link your Spotify artist'}
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/onboarding/artist', params: { from: 'profile' } })
          }
        />
        <Button title="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} />
      </View>

      {/* Danger zone — kept well away from Sign out so it can't be mis-tapped */}
      <View style={styles.dangerZone}>
        <View style={[styles.rule, { backgroundColor: theme.backgroundSelected }]} />
        <ThemedText type="small" themeColor="textSecondary">
          Deleting your account is permanent and removes all your data.
        </ThemedText>
        <Button
          title="Delete account"
          variant="destructive"
          loading={deleting}
          onPress={confirmDeleteAccount}
        />
      </View>
    </MoodScreen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  buttons: {
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  dangerZone: {
    gap: Spacing.two,
    marginTop: Spacing.six,
  },
  rule: {
    height: 1,
    marginBottom: Spacing.two,
  },
});
