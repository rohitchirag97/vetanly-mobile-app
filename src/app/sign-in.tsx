import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandHeader } from '@/components/brand-header';
import { Button } from '@/components/button';
import { CountryCodeButton } from '@/components/country-code-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { getGoogleIdToken, googleEnabled } from '@/lib/google';
import { useSession, type AuthResult } from '@/lib/session';

const HIGHLIGHTS = [
  { icon: 'finger-print', label: 'Attendance' },
  { icon: 'airplane', label: 'Leave' },
  { icon: 'wallet', label: 'Payroll' },
] as const;

export default function SignInScreen() {
  const theme = useTheme();
  const { signIn } = useSession();
  const [countryCode, setCountryCode] = useState('91');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState<'otp' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendOtp = async () => {
    setError(null);
    const digits = phone.replace(/\D/g, '');
    const fullPhone = `${countryCode}${digits}`;
    // Mirrors the server's rule: 11–15 digits including the country code.
    if (digits.length < 6 || fullPhone.length < 11 || fullPhone.length > 15) {
      setError('Enter a valid phone number.');
      return;
    }
    setBusy('otp');
    try {
      await api('/auth/send-otp', { method: 'POST', body: { phone: fullPhone } });
      router.push({ pathname: '/verify-otp', params: { phone: fullPhone } });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    setBusy('google');
    try {
      const credential = await getGoogleIdToken();
      if (!credential) return;
      const res = await api<AuthResult>('/auth/google', { method: 'POST', body: { credential } });
      await signIn(res.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <ThemedView style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bounces={false}>
          <BrandHeader style={styles.header}>
            <Image source={require('../../assets/images/logo.png')} style={styles.logo} accessibilityIgnoresInvertColors />
            <Text style={styles.brand}>Vetanly</Text>
            <Text style={styles.tagline}>Your workday, attendance and pay — all in one place.</Text>
            <View style={styles.highlights}>
              {HIGHLIGHTS.map((item) => (
                <View key={item.label} style={styles.highlight}>
                  <Ionicons name={item.icon} size={14} color="#fff" />
                  <Text style={styles.highlightText}>{item.label}</Text>
                </View>
              ))}
            </View>
          </BrandHeader>

          <Card style={styles.form}>
            <View style={styles.formTitle}>
              <ThemedText type="title">Sign in</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                We&apos;ll text a one-time code to your phone.
              </ThemedText>
            </View>

            <TextField
              label="Phone number"
              value={phone}
              onChangeText={(text) => setPhone(text.replace(/[^\d\s]/g, ''))}
              placeholder="98765 43210"
              keyboardType="phone-pad"
              autoComplete="tel-national"
              textContentType="telephoneNumber"
              maxLength={15}
              editable={!busy}
              returnKeyType="done"
              onSubmitEditing={sendOtp}
              leading={<CountryCodeButton value={countryCode} onChange={setCountryCode} disabled={!!busy} />}
            />

            {error && (
              <View style={[styles.error, { backgroundColor: theme.dangerSoft }]}>
                <Ionicons name="alert-circle" size={18} color={theme.danger} />
                <ThemedText type="small" style={[styles.flex, { color: theme.danger }]} accessibilityRole="alert">
                  {error}
                </ThemedText>
              </View>
            )}

            <Button title="Send code" icon="arrow-forward" onPress={sendOtp} loading={busy === 'otp'} disabled={!!busy} />

            {googleEnabled && (
              <>
                <View style={styles.divider}>
                  <View style={[styles.line, { backgroundColor: theme.border }]} />
                  <ThemedText type="caption" themeColor="textSecondary">
                    OR
                  </ThemedText>
                  <View style={[styles.line, { backgroundColor: theme.border }]} />
                </View>
                <Button
                  title="Continue with Google"
                  variant="outline"
                  onPress={signInWithGoogle}
                  loading={busy === 'google'}
                  disabled={!!busy}
                  icon={<Ionicons name="logo-google" size={18} color="#4285F4" />}
                />
              </>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: Spacing.five },
  header: { paddingBottom: Spacing.six + Spacing.four, alignItems: 'flex-start' },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    marginTop: Spacing.four,
    boxShadow: '0px 8px 24px rgba(20, 8, 80, 0.35)',
  },
  brand: { color: '#fff', fontSize: 32, lineHeight: 38, fontWeight: 800, letterSpacing: -0.8, marginTop: Spacing.four },
  tagline: { color: 'rgba(255,255,255,0.8)', fontSize: 15, lineHeight: 21, marginTop: 6, maxWidth: 300 },
  highlights: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.four, flexWrap: 'wrap' },
  highlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  highlightText: { color: '#fff', fontSize: 13, fontWeight: 600 },
  // Pulled up over the gradient so the form reads as the focus of the screen.
  form: {
    marginTop: -(Spacing.six - Spacing.two),
    marginHorizontal: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three + 4,
    borderRadius: Radius.xl,
  },
  formTitle: { gap: 4 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.sm },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});
