import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ROLE_LABELS, OrganizationSwitcher } from '@/components/organization-switcher';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, IconChip, ListRow, Pill, type IconName } from '@/components/ui';
import { Radius, Spacing, type Tone } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { canManage, isOwner, isPeopleManager, useSession } from '@/lib/session';
type MenuItem = {
  label: string;
  icon: IconName;
  /** Set once the screen exists on mobile; until then the tile shows "Soon". */
  href?: Href;
};
type MenuSection = { label: string; icon: IconName; tone: Tone; items: (MenuItem | false)[] };

/**
 * The web sidebar (client-app/src/components/sidebar.tsx) for the user's role. The mobile app has no
 * "My view" switch, so managers get their own items as well as the management ones.
 */
const buildSections = (people: boolean, manage: boolean, owner: boolean): MenuSection[] => [
  {
    label: 'General',
    icon: 'apps',
    tone: 'primary',
    items: [
      { label: 'Dashboard', icon: 'home-outline', href: '/' },
      { label: 'Announcements', icon: 'megaphone-outline' },
      { label: 'Reports', icon: 'bar-chart-outline' },
      people && { label: 'HR insights', icon: 'analytics-outline' },
      { label: 'My assets', icon: 'cube-outline' },
    ],
  },
  {
    label: 'People',
    icon: 'people',
    tone: 'info',
    items: [
      people && { label: 'Employees', icon: 'people-outline' },
      people && { label: 'Add employee', icon: 'person-add-outline', href: '/employees/new' },
      people && { label: 'Bulk upload', icon: 'cloud-upload-outline', href: '/employees/bulk' },
      people && { label: 'Branches', icon: 'location-outline' },
      people && { label: 'Departments', icon: 'business-outline' },
      people && { label: 'Shifts', icon: 'time-outline' },
      people && { label: 'Shift roster', icon: 'calendar-number-outline' },
      people && { label: 'Assets', icon: 'cube-outline' },
    ],
  },
  {
    label: 'Attendance',
    icon: 'finger-print',
    tone: 'success',
    items: [
      people && { label: 'Attendance', icon: 'calendar-outline' },
      { label: 'My attendance', icon: 'finger-print-outline' },
      { label: 'Corrections', icon: 'create-outline' },
      { label: 'My schedule', icon: 'today-outline' },
      people && { label: 'Overtime', icon: 'timer-outline' },
      manage && { label: 'Kiosks', icon: 'tablet-portrait-outline' },
    ],
  },
  {
    label: 'Leave',
    icon: 'airplane',
    tone: 'warning',
    items: [
      { label: 'Apply for leave', icon: 'airplane-outline' },
      { label: 'Leave applications', icon: 'list-outline' },
      { label: 'Leave log', icon: 'document-text-outline' },
      { label: 'Holidays', icon: 'sunny-outline' },
    ],
  },
  {
    label: 'Payroll',
    icon: 'wallet',
    tone: 'primary',
    items: [
      manage && { label: 'Payroll runs', icon: 'wallet-outline' },
      manage && { label: 'Full & final', icon: 'document-attach-outline' },
      manage && { label: 'Bonus & gratuity', icon: 'gift-outline' },
      people && { label: 'Statutory', icon: 'shield-checkmark-outline' },
      manage && { label: 'Accounting export', icon: 'download-outline' },
      owner && { label: 'Payroll settings', icon: 'settings-outline' },
      { label: 'Salary slips', icon: 'receipt-outline' },
    ],
  },
  {
    label: 'Loans & expenses',
    icon: 'cash',
    tone: 'info',
    items: [
      { label: 'Loans & advances', icon: 'cash-outline' },
      manage && { label: 'All loans', icon: 'list-outline' },
      manage && { label: 'Installments', icon: 'repeat-outline' },
      { label: 'My expenses', icon: 'card-outline' },
      people && { label: 'Review claims', icon: 'checkmark-done-outline' },
    ],
  },
  {
    label: 'Income tax',
    icon: 'document-text',
    tone: 'danger',
    items: [
      { label: 'My tax declaration', icon: 'document-outline' },
      people && { label: 'Tax declarations', icon: 'documents-outline' },
    ],
  },
  {
    label: 'Organization',
    icon: 'business',
    tone: 'success',
    items: [
      manage && { label: 'Messaging', icon: 'chatbubbles-outline' },
      owner && { label: 'Billing', icon: 'pricetag-outline' },
      owner && { label: 'Audit log', icon: 'shield-outline' },
      { label: 'Profile', icon: 'person-circle-outline', href: '/profile' },
    ],
  },
];

export default function MenuScreen() {
  const { activeOrganization } = useSession();
  const [open, setOpen] = useState<string | null>(null);
  const sections = buildSections(
    isPeopleManager(activeOrganization),
    canManage(activeOrganization),
    isOwner(activeOrganization),
  )
    .map((section) => ({ ...section, items: section.items.filter((item): item is MenuItem => Boolean(item)) }))
    .filter((section) => section.items.length > 0);
  // Screens that already work on mobile, surfaced first so the menu isn't a wall of "Soon".
  const ready = sections.flatMap((section) => section.items.map((item) => ({ ...item, tone: section.tone }))).filter((item) => item.href);

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <ThemedText type="display">Menu</ThemedText>
            <View style={styles.headerRow}>
              <OrganizationSwitcher />
              {activeOrganization?.role && <Pill label={ROLE_LABELS[activeOrganization.role]} tone="primary" />}
            </View>
          </View>

          <View style={styles.block}>
            <ThemedText type="overline" themeColor="textSecondary">
              Ready to use
            </ThemedText>
            <View style={styles.readyRow}>
              {ready.map((item) => (
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  onPress={() => item.href && router.navigate(item.href)}
                  style={({ pressed }) => [styles.readyTile, pressed && styles.pressed]}>
                  <Card style={styles.readyCard}>
                    <IconChip name={item.icon} tone={item.tone} size={42} />
                    <ThemedText type="heading">{item.label}</ThemedText>
                  </Card>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.block}>
            <ThemedText type="overline" themeColor="textSecondary">
              All tools
            </ThemedText>
            {sections.map((section) => (
              <SectionCard
                key={section.label}
                section={section}
                open={open === section.label}
                onToggle={() => setOpen(open === section.label ? null : section.label)}
              />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** One group of tools, collapsed to a single row until opened so the menu stays scannable. */
function SectionCard({ section, open, onToggle }: { section: Omit<MenuSection, 'items'> & { items: MenuItem[] }; open: boolean; onToggle: () => void }) {
  const theme = useTheme();
  const readyCount = section.items.filter((item) => item.href).length;
  return (
    <Card padded={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={({ pressed }) => [styles.sectionHead, pressed && styles.pressed]}>
        <IconChip name={section.icon} tone={section.tone} size={42} />
        <View style={styles.flex}>
          <ThemedText type="heading">{section.label}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {section.items.length} tool{section.items.length === 1 ? '' : 's'}
            {readyCount === 0 ? ' · coming soon' : ''}
          </ThemedText>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={theme.textSecondary} />
      </Pressable>
      {open && (
        <View style={[styles.sectionBody, { borderTopColor: theme.border }]}>
          {section.items.map((item, index) => (
            <ListRow
              key={item.label}
              first={index === 0}
              leading={<Ionicons name={item.icon} size={20} color={item.href ? theme.primary : theme.textSecondary} />}
              title={item.label}
              accessibilityLabel={item.href ? item.label : `${item.label}, coming soon`}
              onPress={item.href ? () => router.navigate(item.href!) : undefined}
              trailing={
                item.href ? <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} /> : <Pill label="Soon" tone="neutral" />
              }
            />
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.three, paddingTop: Spacing.three, gap: Spacing.four, maxWidth: 720, width: '100%', alignSelf: 'center' },
  header: { gap: 12, paddingHorizontal: Spacing.one },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  block: { gap: 12 },
  readyRow: { flexDirection: 'row', gap: 12 },
  readyTile: { flex: 1 },
  readyCard: { gap: 12, minHeight: 112, borderRadius: Radius.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: Spacing.three },
  sectionBody: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.three, paddingLeft: 28 },
  pressed: { opacity: 0.7 },
});
