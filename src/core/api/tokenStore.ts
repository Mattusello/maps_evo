/**
 * Token di sessione (Sanctum) del dispositivo.
 *
 * Sta dietro il solito `KeyValueStore`, quindi oggi vive in AsyncStorage e domani può
 * passare a un archivio cifrato (expo-secure-store) senza toccare chi lo usa. È tenuto anche
 * in memoria perché `apiClient` lo legge a ogni richiesta e non può aspettare l'I/O.
 *
 * ⚠️ AsyncStorage **non è cifrato**: prima di andare in produzione con dati reali, questo è
 * il punto da cambiare (vedi `docs/BACKEND.md` §2).
 */
import { asyncStorageStore, STORAGE_KEYS, type KeyValueStore } from '../storage/keyValueStore';

let cached: string | null = null;
let store: KeyValueStore = asyncStorageStore;

/** Sostituisce l'archivio (nei test si passa uno store in memoria). */
export function configureTokenStore(next: KeyValueStore) {
  store = next;
  cached = null;
}

/** Token in memoria: null se non c'è sessione. Non tocca il disco. */
export function getAuthToken(): string | null {
  return cached;
}

/** Rilegge il token dal dispositivo: da chiamare una volta all'avvio. */
export async function loadAuthToken(): Promise<string | null> {
  cached = (await store.getJSON<string>(STORAGE_KEYS.authToken)) ?? null;
  return cached;
}

/** Salva (o cancella, con `null`) il token, in memoria e sul dispositivo. */
export async function setAuthToken(token: string | null): Promise<void> {
  cached = token;
  if (token === null) await store.remove(STORAGE_KEYS.authToken);
  else await store.setJSON(STORAGE_KEYS.authToken, token);
}
