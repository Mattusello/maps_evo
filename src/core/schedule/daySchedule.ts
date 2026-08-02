/**
 * PIANIFICAZIONE DELLA GIORNATA (§6.4).
 *
 * Trasforma la lista ordinata di tappe di un giorno in una timeline con orari:
 * per ogni tappa arrivo, permanenza, partenza, e la tratta di spostamento verso
 * la successiva (distanza + minuti stimati, vedi `core/geo/distance.ts`).
 *
 * Regole:
 * - se una tappa ha un `plannedArrival` fissato dall'utente, quello **vince**: è un vincolo
 *   (prenotazione, orario di apertura). Le tappe senza orario scorrono di conseguenza;
 * - se l'orario fissato è più presto di quanto sia realisticamente raggiungibile, la tappa
 *   è marcata `conflict`: la UI lo segnala invece di mentire spostando l'orario;
 * - la durata è quella indicata, altrimenti una durata tipica per categoria.
 *
 * Funzione pura: nessuna dipendenza da React o dallo storage → facilmente testabile.
 */
import { haversineKm, travelMinutes, travelMode, type TravelMode } from '../geo/distance';
import type { Stop, StopCategory } from '../models';
import { parseClock } from '../utils/time';

/** Inizio giornata di default quando nessuna tappa ha un orario fissato (09:00). */
export const DEFAULT_DAY_START_MIN = 9 * 60;

/** Durate tipiche di permanenza per categoria (minuti), usate quando l'utente non la indica. */
export const DEFAULT_DURATION_MIN: Record<StopCategory, number> = {
  cultura: 90,
  cibo: 75,
  natura: 60,
  panorama: 30,
  shopping: 45,
  notte: 120,
  alloggio: 30,
  trasporto: 20,
  altro: 45,
};

export type ScheduleEntry = {
  stop: Stop;
  /** Arrivo effettivo, in minuti da mezzanotte. */
  arrivalMin: number;
  /** Partenza = arrivo + permanenza. */
  departureMin: number;
  /** Permanenza usata nel calcolo (indicata o tipica per categoria). */
  durationMin: number;
  /** true se la durata è una stima di categoria e non un valore scelto dall'utente. */
  durationIsDefault: boolean;
  /** true se l'orario di arrivo è un vincolo scelto dall'utente. */
  arrivalIsPinned: boolean;
  /** Spostamento dalla tappa precedente (0 per la prima). */
  travelMin: number;
  travelKm: number;
  travelMode: TravelMode;
  /** true se l'orario fissato non è raggiungibile in tempo dalla tappa precedente. */
  conflict: boolean;
};

export type DaySchedule = {
  entries: ScheduleEntry[];
  /** Inizio e fine della giornata pianificata (minuti da mezzanotte). */
  startMin: number;
  endMin: number;
  /** Totali di spostamento della giornata. */
  totalTravelMin: number;
  totalTravelKm: number;
  /** Minuti totali di visita (somma delle permanenze). */
  totalVisitMin: number;
};

/** Permanenza di una tappa: quella indicata, altrimenti la tipica di categoria. */
export function stopDuration(stop: Stop): { minutes: number; isDefault: boolean } {
  return stop.plannedDurationMin
    ? { minutes: stop.plannedDurationMin, isDefault: false }
    : { minutes: DEFAULT_DURATION_MIN[stop.category], isDefault: true };
}

/** Costruisce la timeline di un giorno a partire dalle sue tappe già ordinate. */
export function computeDaySchedule(
  stops: Stop[],
  opts: { dayStartMin?: number } = {}
): DaySchedule {
  const entries: ScheduleEntry[] = [];
  if (stops.length === 0) {
    const start = opts.dayStartMin ?? DEFAULT_DAY_START_MIN;
    return {
      entries,
      startMin: start,
      endMin: start,
      totalTravelMin: 0,
      totalTravelKm: 0,
      totalVisitMin: 0,
    };
  }

  // L'inizio giornata è, in ordine: quello richiesto, l'orario fissato sulla PRIMA tappa,
  // altrimenti le 09:00. Un orario fissato più avanti nella giornata non sposta la partenza:
  // resta un vincolo locale, e le tappe prima di esso scorrono normalmente.
  const startMin = opts.dayStartMin ?? parseClock(stops[0].plannedArrival) ?? DEFAULT_DAY_START_MIN;

  let cursor = startMin;
  let prev: Stop | null = null;

  for (const stop of stops) {
    const travelKm = prev ? haversineKm(prev.location, stop.location) : 0;
    const travelMin = prev ? travelMinutes(travelKm) : 0;
    const earliest = cursor + travelMin;

    const pinned = parseClock(stop.plannedArrival);
    const arrivalMin = pinned ?? earliest;
    const conflict = pinned !== null && pinned < earliest;

    const { minutes: durationMin, isDefault } = stopDuration(stop);
    const departureMin = arrivalMin + durationMin;

    entries.push({
      stop,
      arrivalMin,
      departureMin,
      durationMin,
      durationIsDefault: isDefault,
      arrivalIsPinned: pinned !== null,
      travelMin,
      travelKm,
      travelMode: travelMode(travelKm),
      conflict,
    });

    cursor = departureMin;
    prev = stop;
  }

  return {
    entries,
    startMin: entries[0].arrivalMin,
    endMin: entries[entries.length - 1].departureMin,
    totalTravelMin: entries.reduce((n, e) => n + e.travelMin, 0),
    totalTravelKm: entries.reduce((n, e) => n + e.travelKm, 0),
    totalVisitMin: entries.reduce((n, e) => n + e.durationMin, 0),
  };
}
