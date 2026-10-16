import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { OrganizationSwitcher } from '@/components/organization-switcher';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconChip } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session';

/** Every organization the user belongs to is paused, suspended or has removed them. */
export function NoActiveOrganization() {
  const { signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={[styles.flex, styles.content]}>
        <IconChip name="pause-circle" tone="warning" size={64} />
        <ThemedText type="title" style={styles.center}>
          No organization available
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          Your organizations are paused or suspended right now, or your access was removed. Contact the owner, or check
          each one&apos;s status below.
        </ThemedText>
        <View style={styles.switcher}>
          <OrganizationSwitcher />
        </View>
        <View style={styles.actions}>
          <Button
            title="Sign out"
            variant="danger"
            icon="log-out-outline"
            loading={signingOut}
            onPress={async () => {
              setSigningOut(true);
              await signOut();
            }}
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  center: { textAlign: 'center' },
  switcher: { marginTop: Spacing.two },
  actions: { alignSelf: 'stretch', maxWidth: 420, width: '100%', marginTop: Spacing.three },
});
