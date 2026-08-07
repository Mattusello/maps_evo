/**
 * Accesso alle collezioni persistite (itinerari, giorni, tappe, prezzi).
 *
 * Esiste perché due componenti devono scrivere gli stessi dati con la stessa forma: il
 * `LocalItineraryRepository` (le modifiche dell'utente) e il **SyncEngine** (le modifiche che
 * arrivano dal server). Tenere qui la conoscenza di *come* sono salvate le entità evita che
 * le due strade divergano — e il sync non deve passare dal repository, altrimenti ogni dato
 * ricevuto rifinirebbe in coda per essere rimandato al mittente.
 *
 * I dati sono normalizzati in tre collezioni separate, come farebbe un database relazionale:
 * è ciò che rende naturale il passaggio futuro a expo-sqlite.
 */
import {
  daySchema,
  itinerarySchema,
  priceReportSchema,
  stopSchema,
  type Day,
  type Itinerary,
  type PriceReport,
  type Stop,
} from '../../models';
import { asyncStorageStore, STORAGE_KEYS, type KeyValueStore } from '../../storage/keyValueStore';

export class LocalCollections {
  constructor(private store: KeyValueStore = asyncStorageStore) {}

  private async load<T>(key: string, parse: (raw: unknown) => T): Promise<T[]> {
    const raw = (await this.store.getJSON<unknown[]>(key)) ?? [];
    return raw.map(parse);
  }

  loadItineraries(): Promise<Itinerary[]> {
    return this.load(STORAGE_KEYS.itineraries, (i) => itinerarySchema.parse(i));
  }
  saveItineraries(value: Itinerary[]): Promise<void> {
    return this.store.setJSON(STORAGE_KEYS.itineraries, value);
  }

  loadDays(): Promise<Day[]> {
    return this.load(STORAGE_KEYS.days, (d) => daySchema.parse(d));
  }
  saveDays(value: Day[]): Promise<void> {
    return this.store.setJSON(STORAGE_KEYS.days, value);
  }

  loadStops(): Promise<Stop[]> {
    return this.load(STORAGE_KEYS.stops, (s) => stopSchema.parse(s));
  }
  saveStops(value: Stop[]): Promise<void> {
    return this.store.setJSON(STORAGE_KEYS.stops, value);
  }

  loadPriceReports(): Promise<PriceReport[]> {
    return this.load(STORAGE_KEYS.priceReports, (r) => priceReportSchema.parse(r));
  }
  savePriceReports(value: PriceReport[]): Promise<void> {
    return this.store.setJSON(STORAGE_KEYS.priceReports, value);
  }
}
