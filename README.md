# Vetanly mobile

Expo (SDK 57) app for Vetanly. Users sign in with a phone number and OTP, or with Google, against the API in `../server`.

## Setup

    bun install
    cp .env.example .env    # then fill it in

- `EXPO_PUBLIC_API_URL`: the server's `/api/v1` URL. On a phone, use your computer's LAN IP, not `localhost`.
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`: must be the same value as the server's `GOOGLE_CLIENT_ID`. Leave it empty to hide the Google button.
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`: an iOS OAuth client for the bundle ID `com.vetanly.app`.

For Android, create an Android OAuth client in the same Google Cloud project, with package `com.vetanly.app` and the SHA-1 of your signing key (`cd android && ./gradlew signingReport` after a prebuild, or the SHA-1 shown by EAS).

## Run

Google sign-in uses native code, so it needs a development build. Phone sign-in also works in Expo Go.

    bunx expo run:android    # or run:ios, or: bunx eas-cli build --profile development
    bunx expo start          # Expo Go: phone OTP only

The dev server prints OTPs to the server console until an SMS provider is configured.

## Auth flow

- `src/app/sign-in.tsx`: enter a phone number to get an OTP (`POST /auth/send-otp`), or tap Continue with Google. The Google ID token goes to `POST /auth/google`.
- `src/app/verify-otp.tsx`: enter the OTP (`POST /auth/verify-otp`). The code submits by itself once all 6 digits are in, including when it's autofilled from SMS.
- `src/lib/session.tsx`: keeps the tokens and user in SecureStore (localStorage on web). `Stack.Protected` in `src/app/_layout.tsx` sends signed-out users to sign-in.
- `src/lib/api.ts`: adds the access token to requests. On a 401 it refreshes the token once (`POST /auth/refresh`); if the refresh token is rejected, the user is signed out.
- Signing out calls `POST /auth/logout` and clears the session on the device, even if the server can't be reached.
