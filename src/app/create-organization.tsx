import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, IconChip } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

// Same rule as the server: lowercase letters, numbers and single hyphens.
const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 52);

export default function CreateOrganizationScreen() {
  const theme = useTheme();
  const { user, refresh, signOut } = useSession();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [busy, setBusy] = useState<'create' | 'signout' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setError(null);
    // Trims a trailing hyphen left over from typing, which the server would reject.
    const finalSlug = slugify(slug);
    if (!name.trim() || !finalSlug) {
      setError('Organization name and slug are required.');
      return;
    }
    setBusy('create');
    try {
      await api('/organization', { method: 'POST', body: { name: name.trim(), slug: finalSlug }, auth: true });
      // Loading the new organization into the session moves the user on to the trial screen.
      await refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              // For users who were added to an organization after signing in.
              <RefreshControl
                refreshing={refreshing}
                tintColor={theme.primary}
                onRefresh={async () => {
                  setRefreshing(true);
                  await refresh().catch((err: Error) => setError(err.message));
                  setRefreshing(false);
                }}
              />
            }>
            <IconChip name="business" tone="primary" size={60} />
            <View style={styles.titles}>
              <ThemedText type="overline" style={{ color: theme.primary }}>
                Welcome{user ? `, ${user.fname}` : ''}
              </ThemedText>
              <ThemedText type="display">Set up your organization</ThemedText>
              <ThemedText themeColor="textSecondary">Your team, attendance and payroll will live here.</ThemedText>
            </View>

            <Card style={styles.form}>
              <TextField
                label="Organization name"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (!slugEdited) setSlug(slugify(text));
                }}
                placeholder="Acme Corporation"
                autoFocus
                maxLength={52}
                editable={!busy}
              />
              <TextField
                label="Short name"
                hint="Lowercase letters, numbers and hyphens. Used to identify your organization."
                value={slug}
                onChangeText={(text) => {
                  setSlugEdited(true);
                  // Keeps a trailing hyphen while typing so "acme-" can become "acme-corp".
                  setSlug(text.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-/, '').slice(0, 52));
                }}
                placeholder="acme-corporation"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                returnKeyType="done"
                onSubmitEditing={create}
              />
              {error && (
                <View style={[styles.error, { backgroundColor: theme.dangerSoft }]}>
                  <Ionicons name="alert-circle" size={18} color={theme.danger} />
                  <ThemedText type="small" style={[styles.flex, { color: theme.danger }]} accessibilityRole="alert">
                    {error}
                  </ThemedText>
                </View>
              )}
              <Button title="Create organization" icon="arrow-forward" onPress={create} loading={busy === 'create'} disabled={!!busy} />
            </Card>

            <Card style={[styles.hint, { backgroundColor: theme.infoSoft }]}>
              <Ionicons name="information-circle" size={20} color={theme.info} />
              <ThemedText type="small" style={[styles.flex, { color: theme.info }]}>
                Joining your employer instead? Ask them to add you with this phone number or email, then pull down to refresh.
              </ThemedText>
            </Card>

            <Button
              title="Log out"
              variant="ghost"
              loading={busy === 'signout'}
              disabled={!!busy}
              onPress={async () => {
                setBusy('signout');
                await signOut();
              }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.four, maxWidth: 480, width: '100%', alignSelf: 'center' },
  titles: { gap: Spacing.two },
  form: { gap: Spacing.three + 4, padding: Spacing.four, borderRadius: Radius.xl },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.sm },
  hint: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', boxShadow: 'none' },
});
