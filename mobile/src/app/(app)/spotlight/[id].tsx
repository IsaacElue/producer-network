import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CardProfile } from '@/components/profile-card';
import { MOODS } from '@/constants/design';
import { Fonts } from '@/constants/theme';
import { generateAsciiP } from '@/lib/ascii';
import { supabase } from '@/lib/supabase';
import { ROLE_LABELS, type SpotifyAlbum } from '@/lib/types';

// The immersive profile is the home of the `ember` mood.
const PALETTE = {
  gradientTop: MOODS.ember.gradient[0],
  gradientBottom: MOODS.ember.gradient[1],
  ink: MOODS.ember.ink,
  inkSoft: MOODS.ember.inkSoft,
  label: MOODS.ember.label,
  faint: MOODS.ember.faint,
  hairline: MOODS.ember.hairline,
  ascii: MOODS.ember.ascii,
};

const LINKS: { key: keyof CardProfile; label: string }[] = [
  { key: 'instagram_url', label: 'Instagram' },
  { key: 'tiktok_url', label: 'TikTok' },
  { key: 'soundcloud_url', label: 'SoundCloud' },
  { key: 'youtube_url', label: 'YouTube' },
];

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export default function SpotlightScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<CardProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);
  const heroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollOffset.value, [0, 240], [1, 0.15], 'clamp'),
    transform: [{ translateY: interpolate(scrollOffset.value, [0, 240], [0, -36], 'clamp') }],
  }));

  const ascii = useMemo(() => generateAsciiP(id ?? 'P').join('\n'), [id]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*, profile_tags(tag_options(label, kind)), sound_references(*)')
      .eq('id', id)
      .maybeSingle();
    setProfile((data as CardProfile) ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const tags = (profile?.profile_tags ?? [])
    .map((t) => t.tag_options?.label)
    .filter((l): l is string => Boolean(l));
  const albums = (profile?.spotify_artist_albums ?? []) as SpotifyAlbum[];

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={[PALETTE.gradientTop, PALETTE.gradientBottom]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView edges={['top']} style={styles.nav} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={PALETTE.ink} />
        </Pressable>
        <Text style={styles.navMark}>P</Text>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={PALETTE.ink} />
        </View>
      ) : !profile ? (
        <View style={styles.center}>
          <Text style={styles.inkText}>This profile is no longer available.</Text>
        </View>
      ) : (
        <Animated.ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.hero, heroStyle]}>
            <Text style={styles.ascii} allowFontScaling={false}>
              {ascii}
            </Text>
          </Animated.View>

          <Text style={styles.caption}>PRODUCER NETWORK / PROFILE</Text>
          <Text style={styles.name}>{profile.display_name}</Text>

          <View style={styles.metaBlock}>
            {profile.role ? <MetaRow label="ROLE" value={ROLE_LABELS[profile.role]} /> : null}
            {profile.looking_for.length > 0 ? (
              <MetaRow
                label="LOOKING FOR"
                value={profile.looking_for.map((r) => ROLE_LABELS[r]).join(', ')}
              />
            ) : null}
            {profile.location ? <MetaRow label="LOCATION" value={profile.location} /> : null}
          </View>

          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          {tags.length > 0 ? (
            <View style={styles.section}>
              <SectionLabel>SOUND</SectionLabel>
              <Text style={styles.tagLine}>{tags.join('  ·  ')}</Text>
            </View>
          ) : null}

          {profile.sound_references.length > 0 ? (
            <View style={styles.section}>
              <SectionLabel>I SOUND LIKE</SectionLabel>
              {profile.sound_references.map((r) => (
                <View key={r.id} style={styles.refRow}>
                  {r.image_url ? (
                    <Image source={{ uri: r.image_url }} style={styles.refArt} />
                  ) : (
                    <View style={[styles.refArt, styles.refArtEmpty]} />
                  )}
                  <View style={styles.refText}>
                    <Text style={styles.refName} numberOfLines={1}>
                      {r.name}
                    </Text>
                    {r.ref_type === 'track' && r.artist_name ? (
                      <Text style={styles.refSub} numberOfLines={1}>
                        {r.artist_name}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {LINKS.some(({ key }) => profile[key]) ? (
            <View style={styles.section}>
              <SectionLabel>ELSEWHERE</SectionLabel>
              {LINKS.filter(({ key }) => profile[key]).map(({ key, label }) => (
                <Pressable
                  key={key}
                  onPress={() => Linking.openURL(profile[key] as string)}
                  style={styles.linkRow}>
                  <Text style={styles.metaLabel}>{label.toUpperCase()}</Text>
                  <Ionicons name="arrow-forward" size={16} color={PALETTE.ink} />
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Discography — only renders when a Spotify artist is linked */}
          {profile.spotify_artist_id && albums.length > 0 ? (
            <View style={styles.section}>
              <SectionLabel>DISCOGRAPHY</SectionLabel>
              {profile.spotify_artist_name ? (
                <Text style={styles.discoArtist}>{profile.spotify_artist_name}</Text>
              ) : null}
              <View style={styles.albumGrid}>
                {albums.map((al) => (
                  <View key={al.id} style={styles.album}>
                    {al.imageUrl ? (
                      <Image source={{ uri: al.imageUrl }} style={styles.albumArt} />
                    ) : (
                      <View style={[styles.albumArt, styles.refArtEmpty]} />
                    )}
                    <Text style={styles.albumName} numberOfLines={1}>
                      {al.name}
                    </Text>
                    <Text style={styles.albumMeta}>
                      {(al.releaseDate ?? '').slice(0, 4)} · {al.type.toUpperCase()}
                    </Text>
                  </View>
                ))}
              </View>
              {profile.spotify_artist_url ? (
                <Pressable
                  onPress={() => Linking.openURL(profile.spotify_artist_url as string)}
                  style={styles.linkRow}>
                  <Text style={styles.metaLabel}>OPEN IN SPOTIFY</Text>
                  <Ionicons name="arrow-forward" size={16} color={PALETTE.ink} />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.footer}>
            <Text style={styles.footerMark}>P</Text>
          </View>
        </Animated.ScrollView>
      )}
    </View>
  );
}

const MONO = Fonts.mono;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#8E837A' },
  nav: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  back: { paddingVertical: 8 },
  navMark: { fontFamily: MONO, fontSize: 18, color: PALETTE.ink, letterSpacing: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  inkText: { color: PALETTE.ink, fontSize: 16 },
  content: { paddingHorizontal: 24, paddingBottom: 80 },
  hero: { alignItems: 'center', paddingTop: 96, paddingBottom: 12 },
  ascii: {
    fontFamily: MONO,
    fontSize: 7.5,
    lineHeight: 8,
    color: PALETTE.ascii,
    includeFontPadding: false,
  },
  caption: {
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 2,
    color: PALETTE.faint,
    marginTop: 8,
  },
  name: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '500',
    color: PALETTE.ink,
    marginTop: 8,
    marginBottom: 20,
  },
  metaBlock: { gap: 10, marginBottom: 24 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    borderTopColor: PALETTE.hairline,
    paddingTop: 10,
  },
  metaLabel: {
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 1.5,
    color: PALETTE.label,
    width: 116,
  },
  metaValue: { flex: 1, fontSize: 15, color: PALETTE.ink },
  bio: { fontSize: 19, lineHeight: 30, color: PALETTE.inkSoft, marginBottom: 28 },
  section: { marginBottom: 28, gap: 12 },
  sectionLabel: {
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 2,
    color: PALETTE.faint,
  },
  tagLine: { fontSize: 18, lineHeight: 26, color: PALETTE.ink },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  refArt: { width: 44, height: 44, borderRadius: 4 },
  refArtEmpty: { backgroundColor: 'rgba(246,240,230,0.15)' },
  refText: { flex: 1 },
  refName: { fontSize: 16, color: PALETTE.ink },
  refSub: { fontFamily: MONO, fontSize: 12, color: PALETTE.faint, marginTop: 2 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: PALETTE.hairline,
    paddingTop: 12,
  },
  discoArtist: { fontSize: 18, color: PALETTE.ink, marginTop: -2 },
  albumGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  album: { width: '48%', marginBottom: 18 },
  albumArt: { width: '100%', aspectRatio: 1, borderRadius: 4, marginBottom: 8 },
  albumName: { fontSize: 14, color: PALETTE.ink },
  albumMeta: { fontFamily: MONO, fontSize: 11, letterSpacing: 1, color: PALETTE.faint, marginTop: 2 },
  footer: { alignItems: 'center', marginTop: 12 },
  footerMark: { fontFamily: MONO, fontSize: 40, color: PALETTE.hairline },
});
