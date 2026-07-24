/**
 * LocalAuthRepository — Fase 1: crea e persiste un utente locale anonimo al primo avvio.
 * Serve a popolare ownerId/collaborators. In Fase 2 verrà sostituito da un login reale.
 */
import type { AuthRepository, AuthUser } from '../contracts';
import { asyncStorageStore, STORAGE_KEYS, type KeyValueStore } from '../../storage/keyValueStore';
import { newId } from '../../utils/id';

export class LocalAuthRepository implements AuthRepository {
  constructor(private store: KeyValueStore = asyncStorageStore) {}

  async getCurrentUser(): Promise<AuthUser> {
    const existing = await this.store.getJSON<AuthUser>(STORAGE_KEYS.currentUser);
    if (existing) return existing;
    const user: AuthUser = { id: newId(), displayName: 'Viaggiatore' };
    await this.store.setJSON(STORAGE_KEYS.currentUser, user);
    return user;
  }

  async updateProfile(patch: Partial<Pick<AuthUser, 'displayName' | 'email'>>): Promise<AuthUser> {
    const current = await this.getCurrentUser();
    const updated = { ...current, ...patch };
    await this.store.setJSON(STORAGE_KEYS.currentUser, updated);
    return updated;
  }

  async signOut(): Promise<void> {
    await this.store.remove(STORAGE_KEYS.currentUser);
  }
}
