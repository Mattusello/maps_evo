// Babel config per Expo SDK 57 + NativeWind v4.
// `jsxImportSource: "nativewind"` abilita la prop `className` sui componenti RN.
// Il plugin di react-native-worklets (Reanimated 4) e react-compiler sono gestiti
// automaticamente da `babel-preset-expo`, quindi non vanno aggiunti a mano.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
