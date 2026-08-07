/**
 * Store in-memory che implementa `KeyValueStore`: nei test sostituisce AsyncStorage senza
 * mock globali, così ogni test parte da un dispositivo pulito.
 */
import type { KeyValueStore } from '@/core/storage/keyValueStore';

export function createMemoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    async getJSON<T>(key: string) {
      const raw = data.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    },
    async setJSON<T>(key: string, value: T) {
      data.set(key, JSON.stringify(value));
    },
    async remove(key: string) {
      data.delete(key);
    },
  };
}
