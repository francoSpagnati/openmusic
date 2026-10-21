import { configure } from '@testing-library/react-native';

// In-memory replacement for the native keychain used by `tokenStore`.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

// Reanimated 4 / Worklets need their JS mocks under Jest (no native runtime).
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
// Reanimated 4.7's mock imports the real entry, whose native initializer calls
// `setCSSEventHandler`, which JSReanimated throws on under Jest: skip that initializer.
jest.mock('react-native-reanimated/src/initializers', () => ({
  initializeReanimatedModule: () => undefined,
}));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// findBy*/waitFor default to 1 s, too short for the first render on a cold CI runner.
configure({ asyncUtilTimeout: 10000 });
