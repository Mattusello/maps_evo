/**
 * Factory dei repository: sceglie l'implementazione in base all'ambiente.
 * La UI importa SEMPRE da qui (mai le classi concrete), così il passaggio locale → API
 * è una singola variabile d'ambiente.
 */
import { env } from '../config/env';
import { ApiItineraryRepository } from './api/ApiItineraryRepository';
import { LocalAuthRepository } from './local/LocalAuthRepository';
import { LocalItineraryRepository } from './local/LocalItineraryRepository';
import type { AuthRepository, ItineraryRepository } from './contracts';

export * from './contracts';

let itineraryRepo: ItineraryRepository | null = null;
let authRepo: AuthRepository | null = null;

export function getItineraryRepository(): ItineraryRepository {
  if (!itineraryRepo) {
    itineraryRepo = env.useApiBackend
      ? new ApiItineraryRepository()
      : new LocalItineraryRepository();
  }
  return itineraryRepo;
}

export function getAuthRepository(): AuthRepository {
  if (!authRepo) {
    // In Fase 2 qui si potrà restituire un ApiAuthRepository.
    authRepo = new LocalAuthRepository();
  }
  return authRepo;
}
