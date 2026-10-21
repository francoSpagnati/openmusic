module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo (SDK 58) adds the react-native-worklets plugin for Reanimated 4 itself.
  return { presets: ['babel-preset-expo'] };
};
