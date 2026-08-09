// Metro config standard di Expo.
//
// Senza NativeWind (vedi babel.config.js) non serve `withNativeWind`: `src/global.css` resta
// importato da `app/_layout.tsx` e sul web lo gestisce Metro, che supporta i CSS globali di
// suo. Su native l'import è semplicemente ignorato.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
