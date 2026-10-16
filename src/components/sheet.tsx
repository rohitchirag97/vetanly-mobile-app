import type { PropsWithChildren } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SheetProps = PropsWithChildren<{ visible: boolean; title: string; onClose: () => void }>;

/** A bottom sheet that closes on a tap outside it or the Android back button. */
export function Sheet({ visible, title, onClose, children }: SheetProps) {
  const theme = useTheme();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <ThemedView type="backgroundElement" style={styles.sheet}>
        <SafeAreaView edges={['bottom']}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <ThemedText type="heading" style={styles.title}>
            {title}
          </ThemedText>
          {children}
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10, 8, 20, 0.5)' },
  sheet: { maxHeight: '75%', borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingTop: Spacing.two },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: Spacing.three },
  title: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three },
});
