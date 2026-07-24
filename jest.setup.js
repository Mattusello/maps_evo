/* Mock dei moduli nativi usati dai moduli core, così i test girano in ambiente Node. */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// UUID deterministici (validi per lo schema zod) durante i test.
// Il prefisso `mock` è richiesto da jest per le variabili usate nella factory di jest.mock.
let mockUuidCounter = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () =>
    `00000000-0000-4000-8000-${String(mockUuidCounter++).padStart(12, '0')}`,
}));
