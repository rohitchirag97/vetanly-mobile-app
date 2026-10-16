import type { ConfigContext, ExpoConfig } from 'expo/config';

// The iOS URL scheme is the iOS client ID reversed, so it is derived from .env instead of duplicated in app.json.
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const iosUrlScheme = iosClientId
  ? `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`
  : undefined;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),
    iosUrlScheme ? ['@react-native-google-signin/google-signin', { iosUrlScheme }] : '@react-native-google-signin/google-signin',
  ],
});
