import { Appearance } from 'react-native';

import { getItem, setItem } from '@/lib/storage';

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'themePreference';
let current: ThemePreference = 'system';

// Overrides the scheme app-wide, so every useColorScheme() and the native tab bar follow it with no extra wiring.
const apply = (preference: ThemePreference) => {
  current = preference;
  Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
};

export const getThemePreference = () => current;

/** Applies the saved choice; call once at startup. A device setting, so it survives signing out. */
export async function loadThemePreference() {
  const saved = await getItem(KEY).catch(() => null);
  apply(saved === 'light' || saved === 'dark' ? saved : 'system');
}

export async function setThemePreference(preference: ThemePreference) {
  apply(preference);
  await setItem(KEY, preference).catch(() => {});
}
