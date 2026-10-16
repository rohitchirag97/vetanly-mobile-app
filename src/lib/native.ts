/**
 * Loads a native-backed module when a feature first needs it, not when the app starts. Expo Router loads every
 * screen at launch, so a top-level import of a module missing from the installed build (an older development
 * build, or Expo Go) would crash the whole app instead of just that feature.
 */
export async function loadNative<T>(importer: () => Promise<T>, feature: string): Promise<T> {
  try {
    return await importer();
  } catch {
    throw new Error(`${feature} needs a newer version of the app. Rebuild the development build (bunx expo run:android) and try again.`);
  }
}
