import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandHeader } from '@/components/brand-header';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, IconChip, ListRow, type IconName } from '@/components/ui';
import { Radius, Spacing, type Tone } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useSession, type Organization } from '@/lib/session';

// Same list as client-app/src/components/trial-gate.tsx.
const INCLUDED: { icon: IconName; tone: Tone; title: string; detail: string }[] = [
  { icon: 'finger-print', tone: 'success', title: 'Attendance', detail: 'Face kiosks, corrections and overtime' },
  { icon: 'airplane', tone: 'warning', title: 'Leave & holidays', detail: 'Requests, approvals and announcements' },
  { icon: 'wallet', tone: 'primary', title: 'Payroll', detail: 'PF, ESI, professional tax and TDS' },
  { icon: 'document-text', tone: 'info', title: 'Slips & reports', detail: 'Salary slips, loans and reports' },
];

type StartTrialProps = {
  organization: Organization;
  isOwner: boolean;
  onStarted: () => void;
  onRefresh: () => Promise<void>;
};

/** Shown in place of the app until the owner starts the free trial; the server refuses the workspace's data until then. */
export function StartTrial({ organization, isOwner, onStarted, onRefresh }: StartTrialProps) {
  const theme = useTheme();
  const { signOut } = useSession();
  const [busy, setBusy] = useState<'start' | 'refresh' | 'signout' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    setBusy('start');
    try {
      await api(`/billing/start-trial?organizationId=${encodeURIComponent(organization.id)}`, { method: 'POST', auth: true });
      onStarted();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  const logOut = (
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
  );

  if (!isOwner) {
    return (
      <ThemedView style={[styles.flex, styles.waiting]}>
        <IconChip name="hourglass" tone="warning" size={64} />
        <ThemedText type="title" style={styles.center}>
          {organization.name} isn&apos;t active yet
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          The owner needs to start the free trial before anyone can use this workspace. Check back once they have.
        </ThemedText>
        <View style={styles.waitingActions}>
          <Button
            title="Check again"
            variant="secondary"
            icon="refresh"
            loading={busy === 'refresh'}
            disabled={!!busy}
            onPress={async () => {
              setBusy('refresh');
              await onRefresh();
              setBusy(null);
            }}
          />
          {logOut}
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <BrandHeader style={styles.header}>
          <View style={styles.badge}>
            <Ionicons name="sparkles" size={14} color="#fff" />
            <Text style={styles.badgeText}>14 days free · no card needed</Text>
          </View>
          <Text style={styles.heroTitle}>{organization.name} is ready</Text>
          <Text style={styles.heroText}>Start your free trial to unlock the whole workspace for your team.</Text>
        </BrandHeader>

        <View style={styles.body}>
          <Card padded={false} style={styles.features}>
            <ThemedText type="overline" themeColor="textSecondary" style={styles.featuresTitle}>
              Everything included
            </ThemedText>
            {INCLUDED.map((item, index) => (
              <ListRow
                key={item.title}
                first={index === 0}
                leading={<IconChip name={item.icon} tone={item.tone} size={40} />}
                title={item.title}
                subtitle={item.detail}
                trailing={<Ionicons name="checkmark-circle" size={20} color={theme.success} />}
              />
            ))}
          </Card>

          <View style={[styles.note, { backgroundColor: theme.backgroundSelected }]}>
            <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              The trial runs for 14 days from today and can be started only once. Choose a plan in Billing on the web any time.
            </ThemedText>
          </View>

          {error && (
            <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
              {error}
            </ThemedText>
          )}
          <Button title="Start free trial" icon="rocket-outline" onPress={start} loading={busy === 'start'} disabled={!!busy} />
          {logOut}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  waiting: { alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  waitingActions: { alignSelf: 'stretch', gap: Spacing.two, marginTop: Spacing.three, maxWidth: 420, width: '100%', alignItems: 'stretch' },
  scroll: { paddingBottom: Spacing.five },
  header: { paddingBottom: Spacing.six, gap: Spacing.two },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: Spacing.four,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: 700 },
  heroTitle: { color: '#fff', fontSize: 30, lineHeight: 36, fontWeight: 800, letterSpacing: -0.7, marginTop: Spacing.two },
  heroText: { color: 'rgba(255,255,255,0.82)', fontSize: 15, lineHeight: 21, maxWidth: 340 },
  body: { marginTop: -Spacing.five, paddingHorizontal: Spacing.three, gap: Spacing.three, maxWidth: 560, width: '100%', alignSelf: 'center' },
  features: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.one },
  featuresTitle: { marginBottom: Spacing.one },
  note: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: Radius.md },
});
