/**
 * Outbox di sincronizzazione. In Fase 1 registra le mutazioni locali; in Fase 2 un
 * SyncEngine le rigiocherà verso il backend Laravel svuotando la coda.
 */
import type { OutboxEntity, OutboxEntry, OutboxOp } from '../models';
import { newId } from '../utils/id';
import { nowIso } from '../utils/time';
import { asyncStorageStore, STORAGE_KEYS, type KeyValueStore } from '../storage/keyValueStore';

export class Outbox {
  constructor(private store: KeyValueStore = asyncStorageStore) {}

  async enqueue(entityType: OutboxEntity, entityId: string, op: OutboxOp, payload: unknown) {
    const entries = (await this.store.getJSON<OutboxEntry[]>(STORAGE_KEYS.outbox)) ?? [];
    entries.push({ id: newId(), entityType, entityId, op, payload, createdAt: nowIso() });
    await this.store.setJSON(STORAGE_KEYS.outbox, entries);
  }

  async list(): Promise<OutboxEntry[]> {
    return (await this.store.getJSON<OutboxEntry[]>(STORAGE_KEYS.outbox)) ?? [];
  }

  async clear(): Promise<void> {
    await this.store.setJSON<OutboxEntry[]>(STORAGE_KEYS.outbox, []);
  }
}
