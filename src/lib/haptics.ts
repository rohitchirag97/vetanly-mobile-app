import { Platform } from 'react-native';

type HapticsModule = typeof import('expo-haptics');

// Loaded on first use (see lib/native.ts); stays null when the installed build lacks it, so taps simply don't buzz.
let haptics: Promise<HapticsModule | null> | null = null;
const load = () => (haptics ??= import('expo-haptics').catch(() => null));

// Small physical confirmations. Never awaited, and failures (web, or no vibration motor) are ignored.
const safe = (fn: (module: HapticsModule) => Promise<void>) => {
  if (Platform.OS === 'web') return;
  load()
    .then((module) => (module ? fn(module) : undefined))
    .catch(() => {});
};

export const tapHaptic = () => safe((h) => h.impactAsync(h.ImpactFeedbackStyle.Light));
export const selectHaptic = () => safe((h) => h.selectionAsync());
export const successHaptic = () => safe((h) => h.notificationAsync(h.NotificationFeedbackType.Success));
export const errorHaptic = () => safe((h) => h.notificationAsync(h.NotificationFeedbackType.Error));
