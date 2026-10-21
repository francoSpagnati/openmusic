import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'om_session_token';

/**
 * Persists the session JWT in the platform keychain/keystore (expo-secure-store), never in
 * AsyncStorage. Reads fail closed: a broken keychain behaves like "signed out".
 */
export const tokenStore = {
  async load(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  async save(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },
  async clear(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      // Nothing stored or keychain unavailable: the in-memory token is already gone.
    }
  },
};
