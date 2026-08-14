import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Chip } from '@/components/ui/chip';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ROLE_LABELS, type FeedItem, type Profile, type SoundReference } from '@/lib/types';

export type CardProfile = Profile & {
  profile_tags: { tag_options: { label: string; kind: 'genre' | 'subgenre' } | null }[];
  sound_references: SoundReference[];
};

type Props = {
  profile: CardProfile;
  feedItem: FeedItem;
  onMenu?: () => void;
};

const LINKS: { key: keyof Profile; label: string }[] = [
  { key: 'instagram_url', label: 'Instagram' },
  { key: 'tiktok_url', label: 'TikTok' },
  { key: 'soundcloud_url', label: 'SoundCloud' },
  { key: 'youtube_url', label: 'YouTube' },
];

export function ProfileCard({ profile, feedItem, onMenu }: Props) {
  const theme = useTheme();
  const tags = profile.profile_tags
    .map((t) => t.tag_options)
    .filter((t): t is NonNullable<typeof t> => t !== null);

  const matchReasons: string[] = [];
  if (feedItem.shared_artist_names.length > 0) {
    matchReasons.push(`You both tagged ${feedItem.shared_artist_names.join(', ')}`);
  }
  if (feedItem.shared_track_names.length > 0) {
    matchReasons.push(`You both tagged ${feedItem.shared_track_names.join(', ')}`);
  }
  if (feedItem.similar_artist_names.length > 0) {
    matchReasons.push(`Sounds close to ${feedItem.similar_artist_names.join(', ')}`);
  }
  if (feedItem.shared_tag_labels.length > 0) {
    matchReasons.push(`Shared scenes: ${feedItem.shared_tag_labels.join(', ')}`);
  }
  if (feedItem.role_match === 'mutual') {
    matchReasons.push('You’re each what the other is looking for');
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <ThemedText type="subtitle" numberOfLines={1} style={styles.name}>
            {profile.display_name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {profile.role ? ROLE_LABELS[profile.role] : 'Member'}
            {profile.looking_for.length > 0
              ? ` · looking for ${profile.looking_for.map((r) => ROLE_LABELS[r].toLowerCase()).join(', ')}`
              : ''}
          </ThemedText>
          {profile.location ? (
            <ThemedText type="small" themeColor="textSecondary">
              {profile.location}
            </ThemedText>
          ) : null}
        </View>
        {onMenu ? (
          <Pressable onPress={onMenu} hitSlop={8}>
            <Ionicons name="ellipsis-horizontal" size={22} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {profile.bio ? <ThemedText>{profile.bio}</ThemedText> : null}

      {tags.length > 0 ? (
        <View style={styles.chips}>
          {tags.map((t, i) => (
            <Chip key={`${t.label}-${i}`} label={t.label} />
          ))}
        </View>
      ) : null}

      {profile.sound_references.length > 0 ? (
        <View style={styles.section}>
          <ThemedText type="smallBold">Sounds like</ThemedText>
          {profile.sound_references.slice(0, 5).map((r) => (
            <View key={r.id} style={styles.refRow}>
              {r.image_url ? (
                <Image source={{ uri: r.image_url }} style={styles.art} />
              ) : (
                <View style={[styles.art, { backgroundColor: theme.backgroundSelected }]} />
              )}
              <View style={styles.refText}>
                <ThemedText type="small" numberOfLines={1}>
                  {r.name}
                </ThemedText>
                {r.ref_type === 'track' && r.artist_name ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {r.artist_name}
                  </ThemedText>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {matchReasons.length > 0 ? (
        <ThemedView type="backgroundSelected" style={styles.why}>
          <ThemedText type="smallBold">Why you match</ThemedText>
          {matchReasons.map((reason) => (
            <ThemedText key={reason} type="small" themeColor="textSecondary">
              {reason}
            </ThemedText>
          ))}
        </ThemedView>
      ) : null}

      {LINKS.some(({ key }) => profile[key]) ? (
        <View style={styles.chips}>
          {LINKS.filter(({ key }) => profile[key]).map(({ key, label }) => (
            <Chip
              key={key}
              label={label}
              onPress={() => Linking.openURL(profile[key] as string)}
            />
          ))}
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 24,
    lineHeight: 30,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  refText: {
    flex: 1,
  },
  art: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  why: {
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.one,
  },
});
