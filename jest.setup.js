/* Mock dei moduli nativi usati dai moduli core, così i test girano in ambiente Node. */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// React 19 in modalità concorrente aggiorna lo stato solo dentro `act`: senza questo flag
// i cambi di stato dei test di componente non vengono mai applicati (e React lo segnala).
global.IS_REACT_ACT_ENVIRONMENT = true;

// Reanimated parla con moduli nativi (worklets) che in Node non esistono: nei test si usa
// il mock ufficiale, così le schermate che animano restano montabili.
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// UUID deterministici (validi per lo schema zod) durante i test.
// Il prefisso `mock` è richiesto da jest per le variabili usate nella factory di jest.mock.
let mockUuidCounter = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () =>
    `00000000-0000-4000-8000-${String(mockUuidCounter++).padStart(12, '0')}`,
}));
