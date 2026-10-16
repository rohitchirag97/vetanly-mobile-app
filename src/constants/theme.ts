
import '@/global.css';

import { Platform } from 'react-native';

// Page is a soft tinted grey so white cards lift off it; dark mode uses a deep violet-black for the same layering.
// Each tone has a strong value for icons and text and a soft value for the chip or banner behind it.
export const Colors = {
  light: {
    text: '#15131F',
    textSecondary: '#6E6A82',
    background: '#F5F4FA',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EFEDF7',
    border: '#E6E3F0',
    primary: '#5938E8',
    primarySoft: '#EEEAFE',
    onPrimary: '#FFFFFF',
    success: '#11935A',
    successSoft: '#E3F6EC',
    warning: '#C76A00',
    warningSoft: '#FDF1DE',
    danger: '#DC3545',
    dangerSoft: '#FDE8EA',
    info: '#0B7FC4',
    infoSoft: '#E1F2FC',
  },
  dark: {
    text: '#F3F2FA',
    textSecondary: '#A29EB8',
    background: '#0D0C14',
    backgroundElement: '#17161F',
    backgroundSelected: '#211F2C',
    border: '#2A2838',
    primary: '#8D78FF',
    primarySoft: '#251F47',
    onPrimary: '#FFFFFF',
    success: '#3DD68C',
    successSoft: '#11291D',
    warning: '#F5A524',
    warningSoft: '#30230D',
    danger: '#FF6B72',
    dangerSoft: '#371518',
    info: '#4CC2FF',
    infoSoft: '#0E2636',
  },
} as const;

export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info';

/** The brand gradient behind headers. Needs the New Architecture (the default); elsewhere the primary color shows. */
export const BrandGradient = 'linear-gradient(140deg, #7B5CFF 0%, #5938E8 48%, #3B1FB8 100%)';

/** Raised-card shadow; dark mode relies on the surface color and border instead. */
export const CardShadow = '0px 1px 2px rgba(21, 19, 31, 0.04), 0px 6px 20px rgba(21, 19, 31, 0.06)';

export const Radius = { sm: 10, md: 14, lg: 20, xl: 28 } as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

