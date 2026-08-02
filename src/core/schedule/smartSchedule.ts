/**
 * SMART SCHEDULING (§7) — "Visita il museo alle 9:30: meno coda".
 *
 * Incrocia gli orari pianificati della giornata con l'affollamento **stimato** dal
 * `CrowdProvider` e propone spostamenti di orario che riducono la coda.
 *
 * Prudenza voluta nell'euristica:
 * - si guarda solo in una finestra di poche ore attorno all'orario attuale, per non
 *   stravolgere la giornata;
 * - si resta dentro un orario "civile" (8–22), perché non conosciamo gli orari di apertura
 *   reali (OSM non li fornisce, vedi DATA_PROVIDERS.md);
 * - si scarta un'ora con affollamento quasi nullo: per molte categorie significa "chiuso",
 *   non "vuoto". Meglio nessun suggerimento che un suggerimento sbagliato;
 * - si suggerisce solo con un guadagno percepibile e un salto di livello.
 *
 * Il dato resta dichiaratamente stimato: la UI deve etichettarlo come tale.
 */
import type { CrowdProvider } from '../providers/contracts';
import type { CrowdLevel } from '../models';
import { hourOf } from '../utils/time';
import type { DaySchedule } from './daySchedule';

export type CrowdSuggestion = {
  stopId: string;
  stopTitle: string;
  currentHour: number;
  currentLevel: CrowdLevel;
  suggestedHour: number;
  suggestedLevel: CrowdLevel;
  /** Riduzione stimata dell'intensità di affollamento (0..1). */
  improvement: number;
};

export type SmartScheduleOptions = {
  /** Ampiezza della finestra di ricerca, in ore, attorno all'orario attuale. */
  windowHours?: number;
  /** Estremi dell'orario proponibile. */
  earliestHour?: number;
  latestHour?: number;
  /** Guadagno minimo di intensità per proporre lo spostamento. */
  minImprovement?: number;
  /** Sotto questa intensità l'ora è considerata "morta" (probabile chiusura) e scartata. */
  deadHourIntensity?: number;
  /** Numero massimo di suggerimenti restituiti. */
  max?: number;
};

const DEFAULTS: Required<SmartScheduleOptions> = {
  windowHours: 3,
  earliestHour: 8,
  latestHour: 22,
  minImprovement: 0.15,
  deadHourIntensity: 0.08,
  max: 3,
};

/** Suggerimenti di orario per le tappe più affollate della giornata. */
export function crowdSuggestions(
  schedule: DaySchedule,
  weekday: number,
  crowd: CrowdProvider,
  options: SmartScheduleOptions = {}
): CrowdSuggestion[] {
  const opts = { ...DEFAULTS, ...options };
  const suggestions: CrowdSuggestion[] = [];

  for (const entry of schedule.entries) {
    // Un orario fissato dall'utente è un vincolo (prenotazione): non lo tocchiamo.
    if (entry.arrivalIsPinned) continue;

    const hour = hourOf(entry.arrivalMin);
    const current = crowd.estimateCrowd(entry.stop.category, weekday, hour);
    if (current.level === 'basso') continue;

    let bestHour = hour;
    let bestIntensity = current.intensity;
    let bestLevel: CrowdLevel = current.level;

    const from = Math.max(opts.earliestHour, hour - opts.windowHours);
    const to = Math.min(opts.latestHour, hour + opts.windowHours);
    for (let h = from; h <= to; h++) {
      if (h === hour) continue;
      const candidate = crowd.estimateCrowd(entry.stop.category, weekday, h);
      // Intensità quasi nulla = probabile chiusura, non "poca gente".
      if (candidate.intensity < opts.deadHourIntensity) continue;
      if (candidate.intensity < bestIntensity) {
        bestHour = h;
        bestIntensity = candidate.intensity;
        bestLevel = candidate.level;
      }
    }

    const improvement = current.intensity - bestIntensity;
    if (bestHour !== hour && improvement >= opts.minImprovement && bestLevel !== current.level) {
      suggestions.push({
        stopId: entry.stop.id,
        stopTitle: entry.stop.title,
        currentHour: hour,
        currentLevel: current.level,
        suggestedHour: bestHour,
        suggestedLevel: bestLevel,
        improvement,
      });
    }
  }

  return suggestions.sort((a, b) => b.improvement - a.improvement).slice(0, opts.max);
}
