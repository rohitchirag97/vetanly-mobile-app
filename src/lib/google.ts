import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '@/lib/config';

// The native module only exists on devices with a development build, so the button is hidden on web.
export const googleEnabled = Platform.OS !== 'web' && Boolean(GOOGLE_WEB_CLIENT_ID);

let configured = false;

// Loaded lazily: importing it in Expo Go throws, which would also break phone sign-in.
const loadGoogleSignin = async () => {
  try {
    const module = await import('@react-native-google-signin/google-signin');
    if (!configured) {
      // The ID token's audience is the web client ID, which is what the server verifies against.
      module.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID });
      configured = true;
    }
    return module;
  } catch (error) {
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      throw new Error('Google sign-in needs a development build. It does not work in Expo Go.');
    }
    throw error;
  }
};

/** Opens the Google account picker and returns an ID token, or null if the user backed out. */
export async function getGoogleIdToken(): Promise<string | null> {
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = await loadGoogleSignin();
  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;
    if (!response.data.idToken) throw new Error('Google did not return an ID token. Check the web client ID.');
    return response.data.idToken;
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.IN_PROGRESS) return null;
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play Services is missing or out of date on this device.');
      }
    }
    throw error;
  }
}

/** Forgets the chosen Google account so the picker shows again on the next sign-in. */
export async function googleSignOut() {
  if (!googleEnabled) return;
  try {
    const { GoogleSignin } = await loadGoogleSignin();
    await GoogleSignin.signOut();
  } catch {}
}
