import { StyleSheet, Text, type TextProps } from 'react-native';

import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'display' | 'title' | 'heading' | 'default' | 'small' | 'smallBold' | 'caption' | 'overline';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  return <Text style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]} {...rest} />;
}

// One scale for the whole app: each step is clearly bigger or bolder than the next, so screens read top-down.
const styles = StyleSheet.create({
  display: { fontSize: 30, lineHeight: 36, fontWeight: 700, letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: 700, letterSpacing: -0.3 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: 600, letterSpacing: -0.2 },
  default: { fontSize: 15, lineHeight: 21, fontWeight: 400 },
  small: { fontSize: 13, lineHeight: 18, fontWeight: 400 },
  smallBold: { fontSize: 13, lineHeight: 18, fontWeight: 600 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: 500 },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: 700, letterSpacing: 0.9, textTransform: 'uppercase' },
});
