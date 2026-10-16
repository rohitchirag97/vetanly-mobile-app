import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = TextInputProps & {
  label?: string;
  hint?: string;
  /** Shown inside the field before the input, e.g. a country code. */
  leading?: ReactNode;
};

/** A filled input whose border lights up in the brand color while focused. */
export function TextField({ label, hint, leading, style, onFocus, onBlur, ...props }: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      {label && <ThemedText type="smallBold">{label}</ThemedText>}
      <View
        style={[
          styles.field,
          { backgroundColor: theme.backgroundSelected, borderColor: focused ? theme.primary : 'transparent' },
        ]}>
        {leading}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={theme.textSecondary}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, { color: theme.text }, style]}
          {...props}
        />
      </View>
      {hint && (
        <ThemedText type="caption" themeColor="textSecondary">
          {hint}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  field: { flexDirection: 'row', alignItems: 'center', minHeight: 54, borderRadius: Radius.md, borderWidth: 1.5, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 16, paddingVertical: 14 },
});
