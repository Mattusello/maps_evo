/**
 * Il flusso di import provato dall'esterno, come lo usa una persona: incollo un codice,
 * leggo l'anteprima, confermo. Copre i punti dove è facile sbagliare: un codice illeggibile
 * deve dire perché, e la conferma deve scrivere passando dal contesto (mai dritta al
 * repository).
 *
 * Sta in `src/test/` e non accanto alla schermata perché expo-router impacchetta **ogni**
 * file dentro `src/app/`: un test lì dentro diventerebbe una rotta e farebbe fallire il
 * bundle (importa `@jest/globals`).
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';

import ImportScreen from '@/app/import';
import type { Itinerary, ItineraryWithDetails } from '@/core/models';
import { encodeShareCode } from '@/core/sharing/shareCode';
import { renderWithProviders } from './renderWithProviders';

const ISO = '2026-08-01T10:00:00.000Z';

const mockReplace = jest.fn();
const mockSearchParams: { c?: string } = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    back: jest.fn(),
    canGoBack: () => true,
    push: jest.fn(),
  }),
  useLocalSearchParams: () => mockSearchParams,
}));

const mockImportShared = jest.fn(async () => ({ id: 'nuovo-id' }) as unknown as Itinerary);
jest.mock('@/context/ItinerariesContext', () => ({
  useItineraries: () => ({ importShared: mockImportShared }),
}));

/** Appunti finti, così il test decide cosa "ha copiato" l'utente. */
let mockClipboard = '';
jest.mock('expo-clipboard', () => ({
  getStringAsync: async () => mockClipboard,
  setStringAsync: async () => {},
}));

function fixture(title: string): ItineraryWithDetails {
  const day = {
    id: '00000000-0000-4000-8000-00000000d001',
    createdAt: ISO,
    updatedAt: ISO,
    deletedAt: null,
    syncStatus: 'local' as const,
    itineraryId: '00000000-0000-4000-8000-00000000a001',
    orderedStopIds: ['00000000-0000-4000-8000-00000000f001'],
    stops: [
      {
        id: '00000000-0000-4000-8000-00000000f001',
        createdAt: ISO,
        updatedAt: ISO,
        deletedAt: null,
        syncStatus: 'local' as const,
        dayId: '00000000-0000-4000-8000-00000000d001',
        title: 'Duomo',
        category: 'cultura' as const,
        location: { lat: 43.7731, lng: 11.2559 },
        order: 0,
      },
    ],
  };
  return {
    id: '00000000-0000-4000-8000-00000000a001',
    createdAt: ISO,
    updatedAt: ISO,
    deletedAt: null,
    syncStatus: 'local',
    title,
    ownerId: 'user-1',
    collaborators: [{ userId: 'user-1', role: 'owner' }],
    currency: 'EUR',
    partySize: 2,
    dayIds: [day.id],
    days: [day],
  };
}

describe('schermata di import', () => {
  beforeEach(() => {
    delete mockSearchParams.c;
    mockClipboard = '';
    mockReplace.mockClear();
    mockImportShared.mockClear();
  });

  it('mostra l’anteprima di un codice incollato e importa solo alla conferma', async () => {
    const code = encodeShareCode(fixture('Weekend a Firenze'));
    await renderWithProviders(<ImportScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('Incolla qui…'), code);
    await fireEvent.press(screen.getByText('Leggi'));

    // Anteprima: titolo e conteggi, prima di scrivere qualsiasi cosa.
    expect(await screen.findByText('Weekend a Firenze')).toBeTruthy();
    expect(screen.getByText('1 giorno')).toBeTruthy();
    expect(screen.getByText('1 tappa')).toBeTruthy();
    expect(mockImportShared).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Aggiungi ai miei itinerari'));

    expect(mockImportShared).toHaveBeenCalledTimes(1);
    // L'import è asincrono: si attende che il ciclo di render lo abbia assorbito.
    await screen.findByText('Anteprima');
    expect(mockReplace).toHaveBeenCalledWith('/itinerary/nuovo-id');
  });

  it('legge il codice che arriva dal link, senza incollare nulla', async () => {
    mockSearchParams.c = encodeShareCode(fixture('Tour di Roma'));
    await renderWithProviders(<ImportScreen />);
    expect(await screen.findByText('Tour di Roma')).toBeTruthy();
  });

  it('spiega perché un codice non è leggibile, invece di importare a caso', async () => {
    await renderWithProviders(<ImportScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText('Incolla qui…'), 'non-un-codice-vero');
    await fireEvent.press(screen.getByText('Leggi'));

    expect(await screen.findByText(/Non riesco a leggere questo codice/)).toBeTruthy();
    expect(mockImportShared).not.toHaveBeenCalled();
  });

  it('prende il codice dagli appunti', async () => {
    mockClipboard = encodeShareCode(fixture('Giro in Sicilia'));
    await renderWithProviders(<ImportScreen />);
    await fireEvent.press(screen.getByText('Incolla dagli appunti'));
    expect(await screen.findByText('Giro in Sicilia')).toBeTruthy();
  });

  it('dice che gli appunti sono vuoti invece di restare zitta', async () => {
    await renderWithProviders(<ImportScreen />);
    await fireEvent.press(screen.getByText('Incolla dagli appunti'));
    expect(await screen.findByText(/Negli appunti non c'è nulla/)).toBeTruthy();
  });
});
