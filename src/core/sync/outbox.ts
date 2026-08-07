/**
 * Outbox di sincronizzazione: la coda delle mutazioni locali non ancora arrivate al server.
 *
 * Ogni scrittura del repository locale lascia qui una voce; il `SyncEngine` la manda al
 * backend e la rimuove **solo quando il server ha risposto qualcosa su quella voce**
 * (applicata, in conflitto o rifiutata). Se cade la rete la coda resta intatta: è ciò che
 * permette di continuare a lavorare offline e ritrovare tutto al ritorno del segnale.
 *
 * L'ordine di inserimento è significativo — un giorno va creato prima delle sue tappe —
 * quindi la coda è FIFO e si svuota in ordine.
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

  /** Quante mutazioni aspettano di partire: la UI lo mostra come "da sincronizzare". */
  async count(): Promise<number> {
    return (await this.list()).length;
  }

  /**
   * Toglie dalla coda le voci di cui il server ha risposto. Rilegge la coda al momento
   * della rimozione: mentre la sincronizzazione era in volo l'utente può aver continuato a
   * modificare, e quelle voci nuove non vanno perse.
   */
  async remove(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const done = new Set(ids);
    const entries = await this.list();
    await this.store.setJSON<OutboxEntry[]>(
      STORAGE_KEYS.outbox,
      entries.filter((e) => !done.has(e.id))
    );
  }

  async clear(): Promise<void> {
    await this.store.setJSON<OutboxEntry[]>(STORAGE_KEYS.outbox, []);
  }
}
