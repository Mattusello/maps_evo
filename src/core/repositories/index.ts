/**
 * Factory dei repository: sceglie l'implementazione in base all'ambiente.
 * La UI importa SEMPRE da qui (mai le classi concrete), così il passaggio locale → API
 * è una singola variabile d'ambiente.
 *
 * Nota sull'architettura scelta in Fase 5: con il backend attivo **gli itinerari continuano
 * a passare dal repository locale**. Il server non è un sostituto della memoria del
 * dispositivo ma la sua copia condivisa, e a tenerli allineati è il `SyncEngine`. Così
 * l'app funziona anche senza rete, che per un'app da viaggio non è un dettaglio.
 * `ApiItineraryRepository` resta disponibile per un uso "solo online" (debug, strumenti).
 */
import { env } from '../config/env';
import { ApiSyncTransport } from '../sync/ApiSyncTransport';
import { SyncEngine } from '../sync/syncEngine';
import { ApiAuthRepository } from './api/ApiAuthRepository';
import { LocalAuthRepository } from './local/LocalAuthRepository';
import { LocalItineraryRepository } from './local/LocalItineraryRepository';
import { LocalPriceReportRepository } from './local/LocalPriceReportRepository';
import type { AuthRepository, ItineraryRepository, PriceReportRepository } from './contracts';

export * from './contracts';

let itineraryRepo: ItineraryRepository | null = null;
let authRepo: AuthRepository | null = null;
let priceReportRepo: PriceReportRepository | null = null;
let syncEngine: SyncEngine | null = null;

export function getItineraryRepository(): ItineraryRepository {
  if (!itineraryRepo) itineraryRepo = new LocalItineraryRepository();
  return itineraryRepo;
}

export function getAuthRepository(): AuthRepository {
  if (!authRepo) {
    authRepo = env.useApiBackend ? new ApiAuthRepository() : new LocalAuthRepository();
  }
  return authRepo;
}

export function getPriceReportRepository(): PriceReportRepository {
  if (!priceReportRepo) priceReportRepo = new LocalPriceReportRepository();
  return priceReportRepo;
}

/**
 * Motore di sincronizzazione, o `null` se il backend non è configurato: la UI usa quel
 * `null` per dire chiaramente che i dati restano solo su questo dispositivo.
 */
export function getSyncEngine(): SyncEngine | null {
  if (!env.useApiBackend) return null;
  if (!syncEngine) syncEngine = new SyncEngine(new ApiSyncTransport());
  return syncEngine;
}
