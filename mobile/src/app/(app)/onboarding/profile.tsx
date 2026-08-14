import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MoodBackground } from '@/components/mood-background';
import { StepProgress } from '@/components/onboarding/step-progress';
import { ProfileForm } from '@/components/profile-form';
import { ThemedText } from '@/components/themed-text';
import { FadeInView } from '@/components/ui/fade-in-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function OnboardingProfileScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const editing = from === 'profile';

  return (
    <MoodBackground mood="dusk" seed="onboarding">
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <FadeInView style={styles.header}>
              {!editing ? <StepProgress step={1} total={4} /> : null}
              <ThemedText type="subtitle" style={styles.title}>
                {editing ? 'Edit profile' : 'Set up your profile'}
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                {editing
                  ? 'Update how you show up to collaborators.'
                  : 'The basics first. This is how producers will find you.'}
              </ThemedText>
            </FadeInView>

            <ProfileForm
              submitLabel={editing ? 'Save' : 'Continue'}
              onSaved={() => (editing ? router.back() : router.push('/onboarding/tags'))}
            />
          </ScrollView>
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
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  title: {
    marginTop: Spacing.two,
  },
});
