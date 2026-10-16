import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { SessionProvider, useSession } from '@/lib/session';
import { loadThemePreference } from '@/lib/theme-preference';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* "auto" follows the app's scheme, including a Light or Dark override from Profile. */}
      <StatusBar style="auto" />
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { user, organizations, isLoading } = useSession();
  const hasOrganization = organizations.length > 0;
  const [themeLoaded, setThemeLoaded] = useState(false);
  const ready = !isLoading && themeLoaded;

  useEffect(() => {
    loadThemePreference().finally(() => setThemeLoaded(true));
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Keeps the splash screen up until the stored session and theme are read, so neither the sign-in screen nor the wrong theme flashes.
  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!user && hasOrganization}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="employees/new" />
        <Stack.Screen name="employees/bulk" />
      </Stack.Protected>
      {/* A signed-in user with no organization can only create one. */}
      <Stack.Protected guard={!!user && !hasOrganization}>
        <Stack.Screen name="create-organization" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="verify-otp" />
      </Stack.Protected>
    </Stack>
  );
}
