import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandGradient, Colors, Radius, Spacing } from '@/constants/theme';

// Fixed positions (as % of the header) so the stars don't jump around between renders.
const STARS = [
  [8, 18, 2],
  [22, 8, 1.5],
  [35, 26, 2.5],
  [52, 12, 1.5],
  [64, 30, 2],
  [78, 16, 1.5],
  [88, 40, 2],
  [14, 46, 1.5],
  [46, 44, 1.5],
  [70, 52, 2],
] as const;

type BrandHeaderProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** A CSS linear-gradient; defaults to the brand gradient. */
  gradient?: string;
  /** A solid color shown where gradients aren't supported. */
  fallbackColor?: string;
  stars?: boolean;
};

/** The gradient block at the top of a screen. It runs under the status bar, so it switches the bar to light. */
export function BrandHeader({ children, style, gradient = BrandGradient, fallbackColor = Colors.light.primary, stars }: BrandHeaderProps) {
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('auto');
    }, []),
  );

  return (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top + Spacing.three, backgroundColor: fallbackColor, experimental_backgroundImage: gradient },
        style,
      ]}>
      {/* Two soft circles give the flat gradient some depth. */}
      <View pointerEvents="none" style={[styles.orb, styles.orbLarge]} />
      <View pointerEvents="none" style={[styles.orb, styles.orbSmall]} />
      {stars &&
        STARS.map(([left, top, size], i) => (
          <View
            key={i}
            pointerEvents="none"
            style={[styles.star, { left: `${left}%`, top: `${top}%`, width: size * 2, height: size * 2, borderRadius: size }]}
          />
        ))}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    overflow: 'hidden',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  orb: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  orbLarge: { width: 260, height: 260, top: -90, right: -80 },
  orbSmall: { width: 140, height: 140, bottom: -60, left: -40 },
  star: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.7)' },
});
