import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { MoodScreen } from '@/components/mood-background';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { TagOption } from '@/lib/types';

export default function TagsScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const editing = from === 'profile';
  const { session } = useAuth();
  const userId = session!.user.id;

  const [options, setOptions] = useState<TagOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: opts }, { data: mine }] = await Promise.all([
      supabase.from('tag_options').select('*').order('sort_order'),
      supabase.from('profile_tags').select('tag_id').eq('profile_id', userId),
    ]);
    setOptions((opts ?? []) as TagOption[]);
    setSelected(new Set((mine ?? []).map((t) => t.tag_id as string)));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const genres = options.filter((o) => o.kind === 'genre');
  const selectedGenres = genres.filter((g) => selected.has(g.id));
  const visibleSubgenres = options.filter(
    (o) => o.kind === 'subgenre' && o.parent_id && selected.has(o.parent_id),
  );

  const toggle = (tag: TagOption) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag.id)) {
        next.delete(tag.id);
        // deselecting a genre also drops its subgenres
        if (tag.kind === 'genre') {
          for (const o of options) {
            if (o.parent_id === tag.id) next.delete(o.id);
          }
        }
      } else {
        next.add(tag.id);
      }
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const { error: delError } = await supabase
      .from('profile_tags')
      .delete()
      .eq('profile_id', userId);
    if (delError) {
      setError(delError.message);
      setBusy(false);
      return;
    }
    if (selected.size > 0) {
      const rows = [...selected].map((tag_id) => ({ profile_id: userId, tag_id }));
      const { error: insError } = await supabase.from('profile_tags').insert(rows);
      if (insError) {
        setError(insError.message);
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    if (editing) {
      router.back();
    } else {
      router.push('/onboarding/references');
    }
  };

  if (loading) {
    return (
      <MoodScreen mood="dusk" seed="onboarding" scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </MoodScreen>
    );
  }

  return (
    <MoodScreen mood="dusk" seed="onboarding">
      {step === 1 ? (
        <>
          <ThemedText type="subtitle">What do you make?</ThemedText>
          {!editing ? (
            <ThemedText type="small" themeColor="textSecondary">
              Step 2 of 4. Pick at least one genre.
            </ThemedText>
          ) : null}
          <View style={styles.chips}>
            {genres.map((g) => (
              <Chip
                key={g.id}
                label={g.label}
                selected={selected.has(g.id)}
                onPress={() => toggle(g)}
              />
            ))}
          </View>
          <Button
            title="Continue"
            onPress={() => setStep(2)}
            disabled={selectedGenres.length === 0}
          />
        </>
      ) : (
        <>
          <ThemedText type="subtitle">Narrow it down</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Sub-genres and scenes make your matches much more precise. Optional
            but recommended.
          </ThemedText>
          {selectedGenres.map((g) => {
            const children = visibleSubgenres.filter((s) => s.parent_id === g.id);
            if (children.length === 0) return null;
            return (
              <View key={g.id} style={styles.group}>
                <ThemedText type="smallBold">{g.label}</ThemedText>
                <View style={styles.chips}>
                  {children.map((s) => (
                    <Chip
                      key={s.id}
                      label={s.label}
                      selected={selected.has(s.id)}
                      onPress={() => toggle(s)}
                    />
                  ))}
                </View>
              </View>
            );
          })}
          {error ? <ThemedText type="small" style={styles.error}>{error}</ThemedText> : null}
          <Button
            title={editing ? 'Save' : 'Continue'}
            onPress={save}
            loading={busy}
          />
          <Button title="Back to genres" variant="secondary" onPress={() => setStep(1)} />
        </>
      )}
    </MoodScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  group: {
    gap: Spacing.two,
  },
  error: {
    color: '#e5484d',
  },
});
