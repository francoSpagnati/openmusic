// @ts-check
/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Same monorepo rule as Metro: React 19 / RN 0.88 from apps/mobile, never the root copies.
  resolver: '<rootDir>/tooling/jest-resolver.js',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // The first test of a screen suite pays for transforming and requiring RN/Expo on a cold
  // cache, which takes well over Jest's 5 s default on 2-4 core CI runners.
  testTimeout: 30000,
  testPathIgnorePatterns: ['/node_modules/', '/dist-smoke/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|phosphor-react-native|standard-navigation|socket\\.io-client|engine\\.io-client|@shopify\/flash-list)',
  ],
};
