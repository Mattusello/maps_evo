/**
 * OTTIMIZZAZIONE DEL PERCORSO (§6.5) — euristica locale, senza API a pagamento.
 *
 * Il problema è un TSP su percorso aperto (si parte dalla prima tappa e non si torna
 * al punto di partenza). Per i numeri in gioco in un itinerario reale (poche decine di
 * tappe al giorno) l'ottimo esatto non serve: usiamo la coppia classica
 *
 *   1. **nearest-neighbor** — costruisce un giro plausibile in O(n²): dalla tappa corrente
 *      salta ogni volta alla più vicina non ancora visitata. Veloce ma miope: gli ultimi
 *      salti possono essere lunghissimi.
 *   2. **2-opt** — raffina il giro: se invertendo un sotto-percorso [i..j] la lunghezza
 *      totale cala, lo inverte. Ripete finché non trova più miglioramenti (o si esaurisce
 *      il numero massimo di passate). Elimina gli incroci lasciati dal punto 1.
 *
 * Distanze in linea d'aria (haversine): approssimazione voluta, vedi `core/geo/distance.ts`.
 * La prima tappa resta ancorata di default: di solito è l'hotel o il punto d'arrivo,
 * e vederla spostare sarebbe sorprendente.
 */
import { haversineKm, routeLengthKm } from '../geo/distance';
import type { Location } from '../models';

/** Elemento ottimizzabile: basta un id e una posizione. */
export type RoutePoint = { id: string; location: Location };

export type OptimizeResult = {
  /** Id nell'ordine ottimizzato. */
  orderedIds: string[];
  /** Lunghezza del percorso di partenza (km). */
  beforeKm: number;
  /** Lunghezza del percorso ottimizzato (km). */
  afterKm: number;
  /** Km risparmiati (≥ 0). */
  savedKm: number;
  /** true se l'ordine è effettivamente cambiato. */
  changed: boolean;
};

/** Numero massimo di passate di 2-opt: sufficiente a convergere, evita loop patologici. */
const MAX_2OPT_PASSES = 40;

/**
 * Riordina i punti per minimizzare il tragitto totale.
 * Con meno di 3 punti non c'è nulla da ottimizzare.
 */
export function optimizeRoute(
  points: RoutePoint[],
  opts: { anchorFirst?: boolean } = {}
): OptimizeResult {
  const anchorFirst = opts.anchorFirst ?? true;
  const beforeKm = routeLengthKm(points.map((p) => p.location));

  if (points.length < 3) {
    return {
      orderedIds: points.map((p) => p.id),
      beforeKm,
      afterKm: beforeKm,
      savedKm: 0,
      changed: false,
    };
  }

  const nn = nearestNeighbor(points);
  const improved = twoOpt(nn, anchorFirst);
  const afterKm = routeLengthKm(improved.map((p) => p.location));

  // Se l'euristica non migliora nulla (può succedere: il 2-opt è locale), teniamo
  // l'ordine originale — riordinare senza guadagno confonderebbe l'utente.
  if (afterKm >= beforeKm - 1e-9) {
    return {
      orderedIds: points.map((p) => p.id),
      beforeKm,
      afterKm: beforeKm,
      savedKm: 0,
      changed: false,
    };
  }

  const orderedIds = improved.map((p) => p.id);
  return {
    orderedIds,
    beforeKm,
    afterKm,
    savedKm: beforeKm - afterKm,
    changed: orderedIds.some((id, i) => id !== points[i].id),
  };
}

/**
 * Fase 1: giro iniziale "vai sempre al più vicino".
 * Si parte sempre dal primo punto: se è ancorato è la scelta voluta, altrimenti
 * la partenza è indifferente perché sarà il 2-opt a sistemare il giro.
 */
function nearestNeighbor(points: RoutePoint[]): RoutePoint[] {
  const remaining = points.slice(1);
  const route: RoutePoint[] = [points[0]];

  let current = points[0];
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current.location, remaining[i].location);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    current = remaining.splice(bestIdx, 1)[0];
    route.push(current);
  }
  return route;
}

/** Fase 2: raffinamento 2-opt su percorso aperto. */
function twoOpt(route: RoutePoint[], anchorFirst: boolean): RoutePoint[] {
  const best = [...route];
  // Con la prima tappa ancorata il primo indice invertibile è 1, altrimenti 0.
  const start = anchorFirst ? 1 : 0;

  for (let pass = 0; pass < MAX_2OPT_PASSES; pass++) {
    let improvedThisPass = false;

    for (let i = start; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        if (delta2opt(best, i, j) < -1e-9) {
          // Inverte il segmento [i..j]: è la mossa 2-opt.
          const segment = best.slice(i, j + 1).reverse();
          best.splice(i, segment.length, ...segment);
          improvedThisPass = true;
        }
      }
    }

    if (!improvedThisPass) break;
  }
  return best;
}

/**
 * Variazione di lunghezza invertendo [i..j], calcolata sui soli archi che cambiano
 * (gli archi interni al segmento restano identici, solo percorsi al contrario):
 * si spezzano (i-1,i) e (j,j+1) e si ricuciono (i-1,j) e (i,j+1).
 * Su percorso aperto gli archi ai bordi possono non esistere: in quel caso valgono 0.
 */
function delta2opt(route: RoutePoint[], i: number, j: number): number {
  const prev = route[i - 1];
  const next = route[j + 1];
  const a = route[i];
  const b = route[j];

  const removed =
    (prev ? haversineKm(prev.location, a.location) : 0) +
    (next ? haversineKm(b.location, next.location) : 0);
  const added =
    (prev ? haversineKm(prev.location, b.location) : 0) +
    (next ? haversineKm(a.location, next.location) : 0);

  return added - removed;
}
