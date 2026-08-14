import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AnimatedPill } from '@/components/ui/animated-pill';
import { Button } from '@/components/ui/button';
import { FadeInView } from '@/components/ui/fade-in-view';
import { TextField } from '@/components/ui/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { ROLE_LABELS, USER_ROLES, type UserRole } from '@/lib/types';

type Props = {
  submitLabel: string;
  onSaved: () => void;
};


export function ProfileForm({ submitLabel, onSaved }: Props) {
  const theme = useTheme();
  const { session, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [role, setRole] = useState<UserRole | null>(profile?.role ?? null);
  const [lookingFor, setLookingFor] = useState<UserRole[]>(profile?.looking_for ?? []);
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [location, setLocation] = useState(profile?.location ?? '');
  const [instagram, setInstagram] = useState(profile?.instagram_url ?? '');
  const [tiktok, setTiktok] = useState(profile?.tiktok_url ?? '');
  const [soundcloud, setSoundcloud] = useState(profile?.soundcloud_url ?? '');
  const [youtube, setYoutube] = useState(profile?.youtube_url ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Producer-to-X scope: non-producers are here to find producers, so that's
  // the only "looking for" option they get.
  const lookingForOptions: UserRole[] = role === 'producer' ? USER_ROLES : ['producer'];

  const pickRole = (r: UserRole) => {
    setRole(r);
    if (r !== 'producer') {
      setLookingFor((prev) => (prev.includes('producer') ? ['producer'] : []));
    }
  };

  const toggleLookingFor = (r: UserRole) => {
    setLookingFor((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  };

  const save = async () => {
    if (!session) return;
    if (!displayName.trim() || !role) {
      setError('A name and a role are required');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: saveError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        role,
        looking_for: lookingFor,
        bio: bio.trim(),
        location: location.trim() || null,
        instagram_url: instagram.trim() || null,
        tiktok_url: tiktok.trim() || null,
        soundcloud_url: soundcloud.trim() || null,
        youtube_url: youtube.trim() || null,
      })
      .eq('id', session.user.id);
    if (saveError) {
      setError(saveError.message);
      setBusy(false);
      return;
    }
    await refreshProfile();
    setBusy(false);
    onSaved();
  };

  return (
    <View style={styles.form}>
      {/* Primary decisions — grouped on a flat surface */}
      <FadeInView delay={60}>
        <ThemedView type="backgroundElement" style={styles.panel}>
          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
              Your name
            </ThemedText>
            <TextField
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Artist or producer name"
            />
          </View>

          <View style={styles.blockGap}>
            <ThemedText type="smallBold">I am a…</ThemedText>
            <View style={styles.pills}>
              {USER_ROLES.map((r) => (
                <AnimatedPill
                  key={r}
                  label={ROLE_LABELS[r]}
                  selected={role === r}
                  onPress={() => pickRole(r)}
                />
              ))}
            </View>
          </View>

          <View style={styles.blockGap}>
            <ThemedText type="smallBold">Looking for…</ThemedText>
            <View style={styles.pills}>
              {lookingForOptions.map((r) => (
                <AnimatedPill
                  key={r}
                  label={ROLE_LABELS[r]}
                  selected={lookingFor.includes(r)}
                  onPress={() => toggleLookingFor(r)}
                />
              ))}
            </View>
            {role && role !== 'producer' ? (
              <ThemedText type="small" themeColor="textSecondary">
                On Producer Network, non-producers connect with producers.
              </ThemedText>
            ) : null}
          </View>
        </ThemedView>
      </FadeInView>

      {/* Optional details — visually recessed */}
      <FadeInView delay={140} style={styles.optional}>
        <View style={styles.optionalHeader}>
          <View style={[styles.rule, { backgroundColor: theme.backgroundSelected }]} />
          <ThemedText type="small" themeColor="textSecondary">
            Optional. Add these anytime.
          </ThemedText>
          <View style={[styles.rule, { backgroundColor: theme.backgroundSelected }]} />
        </View>

        <TextField
          label="Bio"
          value={bio}
          onChangeText={setBio}
          multiline
          placeholder="What you make, who you've worked with, what you're after"
        />
        <TextField
          label="Location"
          value={location ?? ''}
          onChangeText={setLocation}
          placeholder="e.g. Dublin"
        />
        <TextField
          label="Instagram"
          value={instagram ?? ''}
          onChangeText={setInstagram}
          autoCapitalize="none"
          placeholder="https://instagram.com/you"
        />
        <TextField
          label="TikTok"
          value={tiktok ?? ''}
          onChangeText={setTiktok}
          autoCapitalize="none"
          placeholder="https://tiktok.com/@you"
        />
        <TextField
          label="SoundCloud"
          value={soundcloud ?? ''}
          onChangeText={setSoundcloud}
          autoCapitalize="none"
          placeholder="https://soundcloud.com/you"
        />
        <TextField
          label="YouTube"
          value={youtube ?? ''}
          onChangeText={setYoutube}
          autoCapitalize="none"
          placeholder="https://youtube.com/@you"
        />
      </FadeInView>

      {error ? <ThemedText type="small" style={styles.error}>{error}</ThemedText> : null}

      <FadeInView delay={220}>
        <Button
          title={submitLabel}
          onPress={save}
          loading={busy}
          disabled={!displayName.trim() || !role}
        />
      </FadeInView>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.four,
    alignSelf: 'stretch',
  },
  panel: {
    padding: Spacing.three,
    borderRadius: 16,
  },
  field: {
    gap: Spacing.one,
  },
  label: {
    marginLeft: Spacing.half,
  },
  blockGap: {
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  optional: {
    gap: Spacing.three,
    opacity: 0.9,
  },
  optionalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rule: {
    flex: 1,
    height: 1,
  },
  error: {
    color: '#e5484d',
  },
});
