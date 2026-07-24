/**
 * Layer di storage astratto: un semplice key-value tipizzato su JSON.
 * Isola AsyncStorage così, se in futuro la struttura dati lo giustifica, si può passare
 * a expo-sqlite implementando la stessa interfaccia senza toccare i repository.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface KeyValueStore {
  getJSON<T>(key: string): Promise<T | null>;
  setJSON<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export const asyncStorageStore: KeyValueStore = {
  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Dato corrotto: meglio ignorarlo che far crashare l'app.
      return null;
    }
  },
  async setJSON<T>(key: string, value: T): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};

/** Prefisso comune per tutte le chiavi dell'app. */
export const STORAGE_KEYS = {
  itineraries: 'mymappa:itineraries',
  days: 'mymappa:days',
  stops: 'mymappa:stops',
  priceReports: 'mymappa:priceReports',
  outbox: 'mymappa:outbox',
  currentUser: 'mymappa:currentUser',
  settings: 'mymappa:settings',
} as const;
