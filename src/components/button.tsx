import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import type { IconName } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tapHaptic } from '@/lib/haptics';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  /** An Ionicons name, or any element such as a brand logo. */
  icon?: IconName | ReactNode;
};

export function Button({ title, onPress, variant = 'primary', loading, disabled, icon }: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const colors = {
    primary: { background: theme.primary, text: theme.onPrimary },
    secondary: { background: theme.primarySoft, text: theme.primary },
    outline: { background: theme.backgroundElement, text: theme.text },
    ghost: { background: 'transparent', text: theme.textSecondary },
    danger: { background: theme.dangerSoft, text: theme.danger },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={() => {
        if (variant === 'primary') tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: colors.background },
        variant === 'outline' && { borderWidth: 1, borderColor: theme.border },
        variant === 'primary' && !inactive && styles.primaryShadow,
        pressed && styles.pressed,
        inactive && { opacity: 0.5 },
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : typeof icon === 'string' ? (
        <Ionicons name={icon as IconName} size={19} color={colors.text} />
      ) : (
        icon
      )}
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: Radius.md,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryShadow: { boxShadow: '0px 6px 16px rgba(89, 56, 232, 0.28)' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  title: { fontSize: 16, fontWeight: 600, letterSpacing: -0.1 },
});
