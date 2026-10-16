import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CardShadow, Radius, Spacing, type Tone } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

const softKey = { primary: 'primarySoft', success: 'successSoft', warning: 'warningSoft', danger: 'dangerSoft', info: 'infoSoft' } as const;

/** A raised surface that groups related content. */
export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElement },
        dark ? { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border } : { boxShadow: CardShadow },
        padded && styles.cardPadded,
        style,
      ]}>
      {children}
    </View>
  );
}

/** An icon on a soft tinted square; the tone tells the reader what kind of thing it is at a glance. */
export function IconChip({ name, tone = 'primary', size = 40 }: { name: IconName; tone?: Tone; size?: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.chip, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: theme[softKey[tone]] }]}>
      <Ionicons name={name} size={size * 0.5} color={theme[tone]} />
    </View>
  );
}

export function Pill({ label, tone = 'primary' }: { label: string; tone?: Tone | 'neutral' }) {
  const theme = useTheme();
  const neutral = tone === 'neutral';
  return (
    <View style={[styles.pill, { backgroundColor: neutral ? theme.backgroundSelected : theme[softKey[tone]] }]}>
      <ThemedText type="caption" style={{ color: neutral ? theme.textSecondary : theme[tone] }}>
        {label}
      </ThemedText>
    </View>
  );
}

/** Initials in a circle. `onBrand` is for use on the gradient header. */
export function Avatar({ name, size = 40, onBrand }: { name: string; size?: number; onBrand?: boolean }) {
  const theme = useTheme();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return (
    <View
      style={[
        styles.chip,
        { width: size, height: size, borderRadius: size / 2 },
        onBrand
          ? { backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)' }
          : { backgroundColor: theme.primarySoft },
      ]}>
      <Text style={{ fontSize: size * 0.38, fontWeight: 700, color: onBrand ? '#fff' : theme.primary }}>{initials}</Text>
    </View>
  );
}

export function SectionHeader({ title, count, action }: { title: string; count?: number; action?: { label: string; onPress: () => void } }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitle}>
        <ThemedText type="heading">{title}</ThemedText>
        {!!count && (
          <View style={[styles.count, { backgroundColor: theme.primary }]}>
            <Text style={[styles.countText, { color: theme.onPrimary }]}>{count}</Text>
          </View>
        )}
      </View>
      {action && (
        <Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={8}>
          <ThemedText type="smallBold" style={{ color: theme.primary }}>
            {action.label}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

type ListRowProps = {
  leading?: ReactNode;
  title: string;
  subtitle?: string | null;
  trailing?: ReactNode;
  onPress?: () => void;
  /** Hides the divider above the row; set on the first row of a card. */
  first?: boolean;
  accessibilityLabel?: string;
};

/** One line in a card list: an icon or avatar, a title with a quieter subtitle, and an optional trailing element. */
export function ListRow({ leading, title, subtitle, trailing, onPress, first, accessibilityLabel }: ListRowProps) {
  const theme = useTheme();
  const content = (
    <>
      {leading}
      <View style={styles.rowText}>
        <ThemedText numberOfLines={1} style={styles.rowTitle}>
          {title}
        </ThemedText>
        {!!subtitle && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        )}
      </View>
      {trailing}
    </>
  );
  const rowStyle = [styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }];
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [rowStyle, pressed && { opacity: 0.6 }]}>
      {content}
    </Pressable>
  ) : (
    <View style={rowStyle}>{content}</View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg },
  cardPadded: { padding: Spacing.three },
  chip: { alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.two },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  count: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 12, fontWeight: 700 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowText: { flex: 1, gap: 1 },
  rowTitle: { fontWeight: 500 },
});
