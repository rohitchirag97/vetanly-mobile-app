import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Sheet } from '@/components/sheet';
import { Avatar, ListRow, Pill } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isSelectableOrganization, useSession, type Organization } from '@/lib/session';

export const ROLE_LABELS: Record<NonNullable<Organization['role']>, string> = {
  super_admin: 'Owner',
  admin: 'Admin',
  hr: 'HR',
  employee: 'Employee',
};

const statusLabel = (organization: Organization) =>
  organization.status === 'suspended'
    ? 'Suspended'
    : organization.status === 'pending_deletion'
      ? 'Being deleted'
      : !organization.membershipActive
        ? 'Access removed'
        : 'Paused';

/** A pill with the active organization's name; tapping it lists every organization the user belongs to. */
export function OrganizationSwitcher({ onBrand }: { onBrand?: boolean }) {
  const theme = useTheme();
  const { organizations, activeOrganization, selectOrganization } = useSession();
  const [open, setOpen] = useState(false);
  const color = onBrand ? '#fff' : theme.text;
  const canSwitch = organizations.length > 1;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Organization: ${activeOrganization?.name ?? 'none'}. Switch organization`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          onBrand
            ? { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.22)' }
            : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          pressed && { opacity: 0.7 },
        ]}>
        <Ionicons name="business" size={15} color={onBrand ? 'rgba(255,255,255,0.9)' : theme.primary} />
        <Text numberOfLines={1} style={[styles.name, { color }]}>
          {activeOrganization?.name ?? 'Choose organization'}
        </Text>
        <Ionicons name={canSwitch ? 'chevron-expand' : 'chevron-down'} size={15} color={color} style={styles.chevron} />
      </Pressable>

      <Sheet visible={open} title="Your organizations" onClose={() => setOpen(false)}>
        <FlatList
          data={organizations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => {
            const selectable = isSelectableOrganization(item);
            const selected = item.id === activeOrganization?.id;
            return (
              <View style={!selectable && styles.disabled}>
                <ListRow
                  first={index === 0}
                  leading={<Avatar name={item.name} size={42} />}
                  title={item.name}
                  subtitle={item.role ? ROLE_LABELS[item.role] : null}
                  accessibilityLabel={`${item.name}${selected ? ', selected' : ''}${selectable ? '' : `, ${statusLabel(item)}`}`}
                  onPress={
                    selectable
                      ? () => {
                          selectOrganization(item.id);
                          setOpen(false);
                        }
                      : undefined
                  }
                  trailing={
                    selected ? (
                      <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                    ) : !selectable ? (
                      <Pill label={statusLabel(item)} tone="neutral" />
                    ) : null
                  }
                />
              </View>
            );
          }}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 1,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 8,
  },
  name: { fontSize: 14, fontWeight: 600, flexShrink: 1 },
  chevron: { opacity: 0.8 },
  list: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three },
  disabled: { opacity: 0.55 },
});
