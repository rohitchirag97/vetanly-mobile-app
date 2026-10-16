import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandHeader } from '@/components/brand-header';
import { Button } from '@/components/button';
import { ROLE_LABELS } from '@/components/organization-switcher';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Avatar, Card, IconChip, ListRow, Pill, type IconName } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { displayPhone, useSession, type User } from '@/lib/session';
import { getThemePreference, setThemePreference, type ThemePreference } from '@/lib/theme-preference';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, activeOrganization, updateUser, signOut } = useSession();
  const [fname, setFname] = useState(user?.fname ?? '');
  const [lname, setLname] = useState(user?.lname ?? '');
  const [busy, setBusy] = useState<'save' | 'signout' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  if (!user) return null;

  const changed = fname.trim() !== user.fname || lname.trim() !== user.lname;
  const phone = displayPhone(user);
  const phoneLinked = !!phone && !!user.phoneVerified;
  const googleLinked = !!user.email && !!user.emailVerified;

  const save = async () => {
    setError(null);
    setSaved(false);
    if (!fname.trim() || !lname.trim()) {
      setError('First and last name are required.');
      return;
    }
    setBusy('save');
    try {
      // PATCH /user returns the user at the top level, not under `data`.
      const res = (await api('/user', {
        method: 'PATCH',
        body: { fname: fname.trim(), lname: lname.trim() },
        auth: true,
      })) as unknown as { user?: User };
      const next = res.user ?? { ...user, fname: fname.trim(), lname: lname.trim() };
      await updateUser(next);
      setFname(next.fname);
      setLname(next.lname);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <ThemedView style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <BrandHeader style={styles.header}>
            <Avatar name={`${user.fname} ${user.lname}`} size={84} onBrand />
            <Text style={styles.name}>
              {user.fname} {user.lname}
            </Text>
            {activeOrganization?.role && (
              <View style={styles.roleChip}>
                <Ionicons name="briefcase" size={12} color="#fff" />
                <Text style={styles.roleText} numberOfLines={1}>
                  {ROLE_LABELS[activeOrganization.role]} · {activeOrganization.name}
                </Text>
              </View>
            )}
          </BrandHeader>

          <View style={styles.body}>
            <Card style={styles.card}>
              <CardTitle icon="person" title="Personal details" />
              <TextField
                label="First name"
                value={fname}
                onChangeText={(text) => {
                  setFname(text);
                  setSaved(false);
                }}
                autoComplete="given-name"
                textContentType="givenName"
                maxLength={52}
                editable={!busy}
              />
              <TextField
                label="Last name"
                value={lname}
                onChangeText={(text) => {
                  setLname(text);
                  setSaved(false);
                }}
                autoComplete="family-name"
                textContentType="familyName"
                maxLength={52}
                editable={!busy}
                returnKeyType="done"
                onSubmitEditing={() => changed && save()}
              />
              {error && (
                <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
                  {error}
                </ThemedText>
              )}
              {saved && !changed && (
                <View style={styles.savedRow}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                  <ThemedText type="smallBold" themeColor="success">
                    Saved
                  </ThemedText>
                </View>
              )}
              <Button
                title="Save changes"
                variant={changed ? 'primary' : 'secondary'}
                onPress={save}
                loading={busy === 'save'}
                disabled={!changed || !!busy}
              />
            </Card>

            <Card style={styles.card}>
              <CardTitle icon="key" title="Sign-in methods" />
              <View>
                <ListRow
                  first
                  leading={<IconChip name="call" tone="success" size={38} />}
                  title="Phone"
                  subtitle={phone ?? 'Not linked'}
                  trailing={<Pill label={phoneLinked ? 'Linked' : phone ? 'Unverified' : 'Not linked'} tone={phoneLinked ? 'success' : 'neutral'} />}
                />
                <ListRow
                  leading={<IconChip name="logo-google" tone="info" size={38} />}
                  title="Google"
                  subtitle={user.email ?? 'Not linked'}
                  trailing={<Pill label={googleLinked ? 'Linked' : user.email ? 'Unverified' : 'Not linked'} tone={googleLinked ? 'success' : 'neutral'} />}
                />
              </View>
              {(!phoneLinked || !googleLinked) && (
                <ThemedText type="caption" themeColor="textSecondary">
                  Link a missing method from your profile on the web app.
                </ThemedText>
              )}
            </Card>

            <Card style={styles.card}>
              <CardTitle icon="color-palette" title="Appearance" />
              <ThemeSwitcher />
            </Card>

            <Button
              title="Sign out"
              variant="danger"
              icon="log-out-outline"
              loading={busy === 'signout'}
              disabled={!!busy}
              onPress={async () => {
                setBusy('signout');
                await signOut();
              }}
            />
            <ThemedText type="caption" themeColor="textSecondary" style={styles.version}>
              Vetanly {Constants.expoConfig?.version ?? ''}
            </ThemedText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function CardTitle({ icon, title }: { icon: IconName; title: string }) {
  const theme = useTheme();
  return (
    <View style={styles.cardTitle}>
      <Ionicons name={icon} size={18} color={theme.primary} />
      <ThemedText type="heading">{title}</ThemedText>
    </View>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: IconName }[] = [
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
];

function ThemeSwitcher() {
  const theme = useTheme();
  const [preference, setPreference] = useState(getThemePreference);
  return (
    <View accessibilityRole="radiogroup" style={styles.themeRow}>
      {THEME_OPTIONS.map((option) => {
        const selected = option.value === preference;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected }}
            onPress={() => {
              setPreference(option.value);
              void setThemePreference(option.value);
            }}
            style={[
              styles.themeOption,
              { backgroundColor: selected ? theme.primarySoft : theme.backgroundSelected, borderColor: selected ? theme.primary : 'transparent' },
            ]}>
            <Ionicons name={option.icon} size={22} color={selected ? theme.primary : theme.textSecondary} />
            <ThemedText type="smallBold" style={{ color: selected ? theme.primary : theme.textSecondary }}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: Spacing.five },
  header: { alignItems: 'center', gap: 10, paddingBottom: Spacing.six },
  name: { color: '#fff', fontSize: 24, lineHeight: 30, fontWeight: 700, letterSpacing: -0.4, marginTop: 4 },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '90%',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  roleText: { color: '#fff', fontSize: 13, fontWeight: 600, flexShrink: 1 },
  // Pulled up so the first card overlaps the bottom of the gradient.
  body: { marginTop: -Spacing.five, paddingHorizontal: Spacing.three, gap: Spacing.three, maxWidth: 560, width: '100%', alignSelf: 'center' },
  card: { gap: Spacing.three },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  themeRow: { flexDirection: 'row', gap: 10 },
  themeOption: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: Radius.md, borderWidth: 1.5 },
  version: { textAlign: 'center', marginTop: Spacing.two },
});
