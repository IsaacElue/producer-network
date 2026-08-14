import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MoodBackground } from '@/components/mood-background';
import { Mono, MOODS, Space, Type } from '@/constants/design';
import { supabase } from '@/lib/supabase';

const M = MOODS.carbon;

type Step = 'landing' | 'email' | 'password';

export default function AuthScreen() {
  const [step, setStep] = useState<Step>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [offerCreate, setOfferCreate] = useState(false);

  const goEmail = () => {
    setError(null);
    setStep('email');
  };

  const submitEmail = () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('That email doesn’t look right.');
      return;
    }
    setError(null);
    setStep('password');
  };

  const signIn = async () => {
    if (!password) return;
    setBusy(true);
    setError(null);
    setOfferCreate(false);
    const { error: e } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (e) {
      // Supabase returns the same error for wrong password and no account, so
      // offer the create path and let sign-up disambiguate.
      setError('That didn’t match.');
      setOfferCreate(true);
    }
    // success → onAuthStateChange in AuthProvider redirects away
  };

  const createAccount = async () => {
    setBusy(true);
    setError(null);
    const { data, error: e } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (e) {
      if (/already|registered|exists/i.test(e.message)) {
        setError('This email already has an account. Check your password.');
        setOfferCreate(false);
      } else {
        setError(e.message);
      }
      return;
    }
    if (!data.session) {
      setError('Account created. Enter your password again to continue.');
      setOfferCreate(false);
    }
    // else success → redirect
  };

  return (
    <MoodBackground mood={M} seed="auth" density={0.72} backdropOpacity={0.5}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.top}>
            {step !== 'landing' ? (
              <Pressable
                onPress={() => {
                  setError(null);
                  setOfferCreate(false);
                  setStep(step === 'password' ? 'email' : 'landing');
                }}
                hitSlop={12}>
                <Text style={styles.backLabel}>← BACK</Text>
              </Pressable>
            ) : null}
          </View>

          {step === 'landing' ? (
            <View style={styles.body}>
              <Text style={styles.kicker}>PRODUCER NETWORK</Text>
              <Text style={styles.display}>Find your{'\n'}collaborators.</Text>
              <Text style={styles.sub}>Matched by the music you actually make.</Text>
              <Pressable onPress={goEmail} style={styles.enter} hitSlop={12}>
                <Text style={styles.enterText}>Enter</Text>
                <Text style={styles.enterArrow}>→</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.body}>
              <Text style={styles.kicker}>{step === 'email' ? 'YOUR EMAIL' : 'PASSWORD'}</Text>
              {step === 'email' ? (
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  onSubmitEditing={submitEmail}
                  autoFocus
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  returnKeyType="next"
                  placeholder="you@example.com"
                  placeholderTextColor={M.faint}
                  style={styles.input}
                />
              ) : (
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={signIn}
                  autoFocus
                  secureTextEntry
                  returnKeyType="go"
                  placeholder="••••••••"
                  placeholderTextColor={M.faint}
                  style={styles.input}
                />
              )}
              <View style={styles.rule} />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              {step === 'email' ? (
                <Pressable onPress={submitEmail} style={styles.enter} hitSlop={12}>
                  <Text style={styles.enterText}>Continue</Text>
                  <Text style={styles.enterArrow}>→</Text>
                </Pressable>
              ) : (
                <View style={styles.actions}>
                  <Pressable
                    onPress={signIn}
                    style={styles.enter}
                    hitSlop={12}
                    disabled={busy}>
                    <Text style={styles.enterText}>{busy ? 'One sec…' : 'Enter'}</Text>
                    <Text style={styles.enterArrow}>→</Text>
                  </Pressable>
                  {offerCreate ? (
                    <Pressable onPress={createAccount} hitSlop={12} disabled={busy}>
                      <Text style={styles.createLabel}>
                        No account with this email? Create one instead →
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </MoodBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1, paddingHorizontal: Space.lg },
  top: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backLabel: { ...Type.label, color: M.label },
  body: { flex: 1, justifyContent: 'center', paddingBottom: Space.xxl, gap: Space.md },
  kicker: { ...Type.label, color: M.accent },
  display: { ...Type.display, color: M.ink },
  sub: { ...Type.body, color: M.inkSoft, marginTop: Space.xs },
  input: {
    fontFamily: Mono,
    fontSize: 24,
    color: M.ink,
    paddingVertical: Space.sm,
  },
  rule: { height: 1, backgroundColor: M.hairline },
  error: { ...Type.meta, color: M.accent, marginTop: Space.sm },
  actions: { gap: Space.lg, marginTop: Space.sm },
  enter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    marginTop: Space.lg,
    alignSelf: 'flex-start',
  },
  enterText: { fontSize: 26, fontWeight: '500', color: M.ink },
  enterArrow: { fontSize: 26, color: M.accent },
  createLabel: { ...Type.meta, color: M.label },
});
