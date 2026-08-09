// Babel config per Expo SDK 57.
//
// NativeWind è stato rimosso: `jsxImportSource: "nativewind"` avvolge ogni elemento JSX e
// rielabora la prop `style`, e su Android questo faceva perdere gli stili passati come
// funzione (`style={({ pressed }) => [...]}`) — Button, Fab e Card premibile restavano senza
// sfondo, quindi invisibili pur restando cliccabili. Il progetto non usava `className` da
// nessuna parte: i colori arrivano tutti da `useTheme()`, quindi non si perde niente.
//
// Il plugin di react-native-worklets (Reanimated 4) e react-compiler sono gestiti
// automaticamente da `babel-preset-expo`, quindi non vanno aggiunti a mano.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
