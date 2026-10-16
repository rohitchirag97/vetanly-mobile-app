import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { ListRow } from '@/components/ui';
import { PHONE_COUNTRY_CODES } from '@/constants/countries';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The "+91 ▾" inside a phone field; opens the country list. */
export function CountryCodeButton({ value, onChange, disabled }: { value: string; onChange: (code: string) => void; disabled?: boolean }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Country code +${value}. Change`}
        onPress={() => setOpen(true)}
        disabled={disabled}
        hitSlop={8}
        style={[styles.code, { borderRightColor: theme.border }]}>
        <ThemedText style={styles.codeText}>+{value}</ThemedText>
        <Ionicons name="chevron-down" size={14} color={theme.textSecondary} />
      </Pressable>
      <Sheet visible={open} title="Country code" onClose={() => setOpen(false)}>
        <FlatList
          data={PHONE_COUNTRY_CODES}
          keyExtractor={(item) => item.code}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <ListRow
              first={index === 0}
              title={item.label}
              accessibilityLabel={`${item.label} +${item.code}${item.code === value ? ', selected' : ''}`}
              onPress={() => {
                onChange(item.code);
                setOpen(false);
              }}
              trailing={
                <View style={styles.option}>
                  <ThemedText themeColor="textSecondary">+{item.code}</ThemedText>
                  {item.code === value && <Ionicons name="checkmark-circle" size={22} color={theme.primary} />}
                </View>
              }
            />
          )}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  code: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 12, marginRight: 12, borderRightWidth: 1 },
  codeText: { fontWeight: 600 },
  list: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
