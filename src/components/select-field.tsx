import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { ListRow } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SelectOption = { value: string; label: string; detail?: string };

type SelectFieldProps = {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** Adds a "None" choice that clears the value. */
  optional?: boolean;
  disabled?: boolean;
  hint?: string;
};

/** Looks like a text field; opens a bottom sheet of choices. */
export function SelectField({ label, value, options, onChange, placeholder = 'Choose…', optional, disabled, hint }: SelectFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const choices = optional ? [{ value: '', label: 'None' }, ...options] : options;

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? 'not set'}. Change`}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.field, { backgroundColor: theme.backgroundSelected }, (pressed || disabled) && { opacity: 0.6 }]}>
        <ThemedText style={[styles.value, !selected && { color: theme.textSecondary }]} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </ThemedText>
        <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
      </Pressable>
      {hint && (
        <ThemedText type="caption" themeColor="textSecondary">
          {hint}
        </ThemedText>
      )}

      <Sheet visible={open} title={label} onClose={() => setOpen(false)}>
        <FlatList
          data={choices}
          keyExtractor={(item) => item.value || 'none'}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <ListRow
              first={index === 0}
              title={item.label}
              subtitle={'detail' in item ? item.detail : undefined}
              accessibilityLabel={`${item.label}${item.value === value ? ', selected' : ''}`}
              onPress={() => {
                onChange(item.value);
                setOpen(false);
              }}
              trailing={item.value === value ? <Ionicons name="checkmark-circle" size={22} color={theme.primary} /> : null}
            />
          )}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  field: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 54, borderRadius: Radius.md, paddingHorizontal: 14 },
  value: { flex: 1, fontSize: 16 },
  list: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three },
});
