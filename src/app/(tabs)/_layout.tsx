import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { NoActiveOrganization } from '@/components/no-active-organization';
import { StartTrial } from '@/components/start-trial';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { BillingProvider, useBilling } from '@/lib/billing';
import { useSession, type Organization } from '@/lib/session';

export default function TabsLayout() {
  const { activeOrganization } = useSession();
  if (!activeOrganization) return <NoActiveOrganization />;
  // Keyed so switching organizations starts every tab fresh, with no data from the previous one.
  return (
    <BillingProvider key={activeOrganization.id} organizationId={activeOrganization.id}>
      <TrialGate organization={activeOrganization} />
    </BillingProvider>
  );
}

/** Until the owner starts the free trial the server refuses the workspace's data, so no tab is shown. */
function TrialGate({ organization }: { organization: Organization }) {
  const { billing, reload, markTrialStarted } = useBilling();

  if (!billing) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (billing.state === 'inactive') {
    return <StartTrial organization={organization} isOwner={billing.isOwner} onStarted={markTrialStarted} onRefresh={reload} />;
  }

  return <Tabs />;
}

function Tabs() {
  const theme = useTheme();
  return (
    <NativeTabs
      backgroundColor={theme.background}
      indicatorColor={theme.backgroundElement}
      iconColor={{ default: theme.textSecondary, selected: theme.primary }}
      labelStyle={{ default: { color: theme.textSecondary }, selected: { color: theme.primary } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="home-outline" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="menu">
        <NativeTabs.Trigger.Label>Menu</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="grid-outline" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="person-circle-outline" />} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
