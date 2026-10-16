import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconChip } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useSession, type AuthResult } from '@/lib/session';

const LENGTH = 6;

export default function VerifyOtpScreen() {
  const theme = useTheme();
  const { signIn } = useSession();
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const input = useRef<TextInput>(null);
  const [otp, setOtp] = useState('');
  const [focused, setFocused] = useState(true);
  const [busy, setBusy] = useState<'verify' | 'resend' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!phone) return <Redirect href="/sign-in" />;

  const verify = async (code = otp) => {
    setError(null);
    setInfo(null);
    if (code.length !== LENGTH) {
      setError('Enter the 6-digit code.');
      return;
    }
    setBusy('verify');
    try {
      const res = await api<AuthResult>('/auth/verify-otp', { method: 'POST', body: { phone, otp: code } });
      // The navigator's guard switches to the app once the session is set.
      await signIn(res.data);
    } catch (err) {
      setError((err as Error).message);
      setOtp('');
      setBusy(null);
      input.current?.focus();
    }
  };

  const resend = async () => {
    setError(null);
    setInfo(null);
    setBusy('resend');
    try {
      await api('/auth/send-otp', { method: 'POST', body: { phone } });
      setOtp('');
      setInfo('A new code is on its way.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.nav}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change number"
              onPress={() => router.back()}
              disabled={busy === 'verify'}
              style={[styles.back, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <Ionicons name="chevron-back" size={22} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <IconChip name="chatbubble-ellipses" tone="primary" size={60} />
            <View style={styles.titles}>
              <ThemedText type="display">Check your messages</ThemedText>
              <ThemedText themeColor="textSecondary">
                Enter the 6-digit code we sent to <ThemedText style={styles.phone}>+{phone}</ThemedText>
              </ThemedText>
            </View>

            {/* One hidden input holds the code so SMS autofill and paste work; the boxes only display it. */}
            <Pressable accessibilityLabel="One-time code" onPress={() => input.current?.focus()} style={styles.boxes}>
              {Array.from({ length: LENGTH }, (_, index) => {
                const digit = otp[index];
                const active = focused && index === Math.min(otp.length, LENGTH - 1) && busy !== 'verify';
                return (
                  <View
                    key={index}
                    style={[
                      styles.box,
                      {
                        backgroundColor: digit ? theme.primarySoft : theme.backgroundElement,
                        borderColor: error ? theme.danger : active ? theme.primary : digit ? theme.primarySoft : theme.border,
                      },
                    ]}>
                    <ThemedText style={[styles.digit, { color: digit ? theme.primary : theme.textSecondary }]}>{digit ?? ''}</ThemedText>
                  </View>
                );
              })}
              <TextInput
                ref={input}
                value={otp}
                onChangeText={(text) => {
                  const code = text.replace(/\D/g, '').slice(0, LENGTH);
                  setOtp(code);
                  setError(null);
                  // Submits as soon as the code is complete, including when it's autofilled from SMS.
                  if (code.length === LENGTH && !busy) verify(code);
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                keyboardType="number-pad"
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                autoFocus
                maxLength={LENGTH}
                editable={busy !== 'verify'}
                caretHidden
                style={styles.hiddenInput}
              />
            </Pressable>

            {error && (
              <View style={styles.message}>
                <Ionicons name="alert-circle" size={16} color={theme.danger} />
                <ThemedText type="small" style={{ color: theme.danger }} accessibilityRole="alert">
                  {error}
                </ThemedText>
              </View>
            )}
            {info && (
              <View style={styles.message}>
                <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                <ThemedText type="small" themeColor="success">
                  {info}
                </ThemedText>
              </View>
            )}

            <Button title="Verify and continue" onPress={() => verify()} loading={busy === 'verify'} disabled={!!busy || otp.length !== LENGTH} />

            <View style={styles.resendRow}>
              <ThemedText type="small" themeColor="textSecondary">
                Didn&apos;t get it?
              </ThemedText>
              <Pressable accessibilityRole="button" onPress={resend} disabled={!!busy} hitSlop={8}>
                <ThemedText type="smallBold" style={{ color: theme.primary, opacity: busy ? 0.5 : 1 }}>
                  {busy === 'resend' ? 'Sending…' : 'Resend code'}
                </ThemedText>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  nav: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.four, gap: Spacing.four, maxWidth: 480, width: '100%', alignSelf: 'center' },
  titles: { gap: Spacing.two },
  phone: { fontWeight: 700 },
  boxes: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  box: { flex: 1, aspectRatio: 0.85, maxHeight: 64, borderRadius: Radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  digit: { fontSize: 26, lineHeight: 32, fontWeight: 700 },
  // Covers the boxes but is invisible, so taps focus it and the OS can autofill it.
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.01, color: 'transparent' },
  message: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -Spacing.two },
  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
});
