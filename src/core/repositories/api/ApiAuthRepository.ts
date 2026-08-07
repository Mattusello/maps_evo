/**
 * ApiAuthRepository — sessione vera con il backend (Sanctum, `docs/BACKEND.md` §2).
 *
 * Regola che guida tutto il file: **l'identità locale non sparisce mai**. Chi non ha ancora
 * fatto accesso, chi è offline e chi esce dalla sessione continuano ad avere un utente con
 * cui firmare gli itinerari; il login aggiunge una sessione, non azzera il dispositivo.
 * Per questo l'identità anonima resta delegata a `LocalAuthRepository`.
 */
import { apiClient, ApiError, getAuthToken, loadAuthToken, setAuthToken } from '../../api/apiClient';
import { asyncStorageStore, STORAGE_KEYS, type KeyValueStore } from '../../storage/keyValueStore';
import type {
  AuthUser,
  RemoteAuthRepository,
  SignInInput,
  SignUpInput,
} from '../contracts';
import { LocalAuthRepository } from '../local/LocalAuthRepository';

type SessionResponse = { token: string; user: AuthUser };

/** Nome con cui il token compare nella lista dei dispositivi dell'utente. */
const DEVICE_NAME = 'MyMappa';

export class ApiAuthRepository implements RemoteAuthRepository {
  constructor(
    private local: LocalAuthRepository = new LocalAuthRepository(),
    private store: KeyValueStore = asyncStorageStore
  ) {}

  getCurrentUser(): Promise<AuthUser> {
    // Con o senza sessione, l'utente corrente è quello salvato sul dispositivo: dopo il
    // login è quello del server, prima è quello anonimo creato al primo avvio.
    return this.local.getCurrentUser();
  }

  updateProfile(patch: Partial<Pick<AuthUser, 'displayName' | 'email'>>): Promise<AuthUser> {
    return this.local.updateProfile(patch);
  }

  hasSession(): boolean {
    return getAuthToken() !== null;
  }

  async signIn(input: SignInInput): Promise<AuthUser> {
    const session = await apiClient.post<SessionResponse>(
      '/api/auth/login',
      { ...input, deviceName: DEVICE_NAME },
      { anonymous: true }
    );
    return this.acceptSession(session);
  }

  async signUp(input: SignUpInput): Promise<AuthUser> {
    const session = await apiClient.post<SessionResponse>(
      '/api/auth/register',
      { ...input, deviceName: DEVICE_NAME },
      { anonymous: true }
    );
    return this.acceptSession(session);
  }

  async restoreSession(): Promise<AuthUser | null> {
    const token = await loadAuthToken();
    if (!token) return null;

    try {
      const { user } = await apiClient.get<{ user: AuthUser }>('/api/auth/me');
      await this.store.setJSON(STORAGE_KEYS.currentUser, user);
      return user;
    } catch (e) {
      // Senza rete la sessione non è "scaduta": si continua con l'utente conosciuto.
      if (e instanceof ApiError && e.isNetwork) return this.getCurrentUser();
      // 401: il token non vale più. `apiClient` lo ha già cancellato.
      return null;
    }
  }

  async signOut(): Promise<void> {
    try {
      await apiClient.post<void>('/api/auth/logout');
    } catch {
      // Se il server non risponde si esce lo stesso: il token locale va comunque buttato.
    }
    await setAuthToken(null);
    // L'utente resta salvato: i suoi itinerari sul dispositivo continuano a essere suoi.
  }

  /** Salva token e utente: da qui in poi le richieste viaggiano autenticate. */
  private async acceptSession({ token, user }: SessionResponse): Promise<AuthUser> {
    await setAuthToken(token);
    await this.store.setJSON(STORAGE_KEYS.currentUser, user);
    return user;
  }
}
