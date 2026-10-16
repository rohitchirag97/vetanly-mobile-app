import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// SecureStore (Keychain / Keystore) on devices; web has no secure storage, so it falls back to localStorage.
const web = Platform.OS === 'web';

export const getItem = async (key: string): Promise<string | null> => {
  if (!web) return SecureStore.getItemAsync(key);
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const setItem = async (key: string, value: string): Promise<void> => {
  if (!web) return SecureStore.setItemAsync(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {}
};

export const removeItem = async (key: string): Promise<void> => {
  if (!web) return SecureStore.deleteItemAsync(key);
  try {
    localStorage.removeItem(key);
  } catch {}
};
