/**
 * Utility geografiche: distanze in linea d'aria fra coordinate.
 *
 * Volutamente senza API esterne (nessun costo, nessuna chiave, funziona offline):
 * per l'ottimizzazione del percorso e la stima degli spostamenti in città la distanza
 * haversine è un'approssimazione sufficiente. Se in futuro si collegherà un servizio
 * Directions, basterà sostituire `travelMinutes` con una matrice reale.
 */
import type { Location } from '../models';

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Distanza in km fra due punti (formula dell'emisenoverso). */
export function haversineKm(a: Location, b: Location): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Lunghezza totale (km) di un percorso aperto che tocca i punti nell'ordine dato. */
export function routeLengthKm(points: Location[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineKm(points[i - 1], points[i]);
  return total;
}

/** Velocità medie usate per stimare i tempi di spostamento (km/h). */
export const SPEED_KMH = {
  /** A piedi, su tratte brevi in città. */
  walk: 4.5,
  /** Mezzi pubblici / auto in ambito urbano, soste incluse. */
  transit: 22,
} as const;

/** Oltre questa distanza si assume uno spostamento motorizzato invece che a piedi. */
export const WALK_MAX_KM = 1.2;

export type TravelMode = 'walk' | 'transit';

/** Modalità presunta per una tratta, in base alla sola distanza. */
export function travelMode(distanceKm: number): TravelMode {
  return distanceKm <= WALK_MAX_KM ? 'walk' : 'transit';
}

/**
 * Minuti stimati per coprire una distanza, arrotondati a multipli di 5 (onestà del dato:
 * è una stima, non ha senso mostrare "13 minuti"). Minimo 5 minuti se i punti sono distinti.
 */
export function travelMinutes(distanceKm: number): number {
  if (distanceKm <= 0) return 0;
  const minutes = (distanceKm / SPEED_KMH[travelMode(distanceKm)]) * 60;
  return Math.max(5, Math.round(minutes / 5) * 5);
}
