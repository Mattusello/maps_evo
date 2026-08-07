module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Reanimated 4 gira su react-native-worklets, che di default risolve i file `.native.*`
  // e cerca moduli JSI inesistenti in Node. Questo resolver (fornito dal pacchetto) fa
  // risolvere le varianti non native: senza, nessuna schermata è montabile nei test.
  resolver: 'react-native-worklets/jest/resolver.js',
  moduleNameMapper: {
    // Metro prende la build ESM (.mjs), che il transform di jest non tocca: nei test
    // puntiamo alla build CommonJS dello stesso pacchetto. Serve ai test di componente,
    // perché ogni schermata importa icone da qui.
    '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  // Trasforma i pacchetti RN/Expo (ESM) necessari.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-qrcode-svg|lucide-react-native|nativewind|@gorhom/.*))',
  ],
};
