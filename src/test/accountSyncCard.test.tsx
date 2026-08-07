/**
 * I tre stati della sezione "Account e sincronizzazione". Senza un backend vero questa è
 * l'unica verifica possibile che il modulo di accesso e lo stato "connesso" esistano
 * davvero e dicano la verità (in particolare: quante modifiche restano da inviare).
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';

import { AccountSyncCard } from '@/features/sync/AccountSyncCard';
import { renderWithProviders } from './renderWithProviders';

const mockAuth = {
  user: { id: 'u1', displayName: 'Marta', email: 'marta@example.test' },
  ready: true,
  remote: false,
  signedIn: false,
  updateProfile: jest.fn(),
  signIn: jest.fn(async () => {}),
  signUp: jest.fn(async () => {}),
  signOut: jest.fn(async () => {}),
};

const mockSync = {
  enabled: false,
  syncing: false,
  lastSyncAt: null as string | null,
  pending: 0,
  lastReport: null as { conflicts: number; error?: string } | null,
  syncNow: jest.fn(async () => {}),
};

jest.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/context/SyncContext', () => ({ useSync: () => mockSync }));

describe('Account e sincronizzazione', () => {
  beforeEach(() => {
    Object.assign(mockAuth, { remote: false, signedIn: false });
    Object.assign(mockSync, {
      enabled: false,
      syncing: false,
      lastSyncAt: null,
      pending: 0,
      lastReport: null,
    });
    mockAuth.signIn.mockClear();
    mockSync.syncNow.mockClear();
  });

  it('senza backend dice che i dati restano sul dispositivo e come attivarlo', async () => {
    mockSync.pending = 3;
    await renderWithProviders(<AccountSyncCard />);

    expect(screen.getByText('Solo su questo dispositivo')).toBeTruthy();
    expect(screen.getByText(/3 modifiche in attesa/)).toBeTruthy();
    expect(screen.getByText(/EXPO_PUBLIC_USE_API/)).toBeTruthy();
  });

  it('con backend attivo ma senza sessione mostra l’accesso, e sa diventare registrazione', async () => {
    Object.assign(mockAuth, { remote: true });
    Object.assign(mockSync, { enabled: true });
    await renderWithProviders(<AccountSyncCard />);

    expect(screen.getByText('Accedi al tuo account')).toBeTruthy();
    // Senza credenziali il pulsante non si può premere.
    expect(screen.getByText('Accedi')).toBeTruthy();
    expect(mockAuth.signIn).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Non hai un account? Creane uno'));
    expect(screen.getByText('Crea un account')).toBeTruthy();
    expect(screen.getByText('Nome')).toBeTruthy();
  });

  it('accede con le credenziali inserite', async () => {
    Object.assign(mockAuth, { remote: true });
    Object.assign(mockSync, { enabled: true });
    await renderWithProviders(<AccountSyncCard />);

    await fireEvent.changeText(screen.getByLabelText('Email'), 'marta@example.test');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'una-password');
    await fireEvent.press(screen.getByText('Accedi'));

    expect(mockAuth.signIn).toHaveBeenCalledWith({
      email: 'marta@example.test',
      password: 'una-password',
    });
  });

  it('connessi: mostra chi sei, cosa manca da inviare e i conflitti', async () => {
    Object.assign(mockAuth, { remote: true, signedIn: true });
    Object.assign(mockSync, {
      enabled: true,
      lastSyncAt: '2026-09-12T08:30:00.000Z',
      pending: 2,
      lastReport: { conflicts: 1 },
    });
    await renderWithProviders(<AccountSyncCard />);

    expect(screen.getByText('Marta')).toBeTruthy();
    expect(screen.getByText('marta@example.test')).toBeTruthy();
    expect(screen.getByText(/Ultima sincronizzazione/)).toBeTruthy();
    expect(screen.getByText('2 modifiche da inviare')).toBeTruthy();
    expect(screen.getByText(/è stata sovrascritta/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Sincronizza ora'));
    expect(mockSync.syncNow).toHaveBeenCalledTimes(1);
  });

  it('connessi e in pari: lo dice invece di restare muta', async () => {
    Object.assign(mockAuth, { remote: true, signedIn: true });
    Object.assign(mockSync, { enabled: true, lastSyncAt: '2026-09-12T08:30:00.000Z' });
    await renderWithProviders(<AccountSyncCard />);

    expect(screen.getByText('Tutto sincronizzato')).toBeTruthy();
  });
});
