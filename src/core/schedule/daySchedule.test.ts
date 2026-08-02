import { describe, expect, it } from '@jest/globals';

import type { Stop, StopCategory } from '../models';
import { EstimatedCrowdProvider } from '../providers/crowd/EstimatedCrowdProvider';
import { formatClock, formatDuration, parseClock, weekdayOf } from '../utils/time';
import { DEFAULT_DAY_START_MIN, DEFAULT_DURATION_MIN, computeDaySchedule } from './daySchedule';
import { crowdSuggestions } from './smartSchedule';

let seq = 0;
function makeStop(partial: Partial<Stop> & { title: string }): Stop {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local',
    dayId: '00000000-0000-4000-8000-00000000dddd',
    category: 'cultura' as StopCategory,
    location: { lat: 43.7696, lng: 11.2558 },
    order: seq,
    ...partial,
  };
}

describe('utility orarie', () => {
  it('converte avanti e indietro gli orari', () => {
    expect(parseClock('09:30')).toBe(570);
    expect(parseClock('00:00')).toBe(0);
    expect(formatClock(570)).toBe('09:30');
    expect(formatClock(0)).toBe('00:00');
  });

  it('rifiuta orari non validi', () => {
    expect(parseClock('25:00')).toBeNull();
    expect(parseClock('9.30')).toBeNull();
    expect(parseClock('')).toBeNull();
    expect(parseClock(undefined)).toBeNull();
  });

  it('formatta le durate in modo leggibile', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(90)).toBe('1 h 30 min');
    expect(formatDuration(120)).toBe('2 h');
  });

  it('ricava il giorno della settimana dalla data del giorno', () => {
    // 2026-08-02 è una domenica.
    expect(weekdayOf('2026-08-02')).toBe(0);
    // Senza data usa il fallback fornito.
    expect(weekdayOf(undefined, new Date(2026, 7, 5))).toBe(3);
  });
});

describe('computeDaySchedule', () => {
  it('gestisce un giorno vuoto', () => {
    const s = computeDaySchedule([]);
    expect(s.entries).toHaveLength(0);
    expect(s.startMin).toBe(DEFAULT_DAY_START_MIN);
    expect(s.totalTravelKm).toBe(0);
  });

  it('parte alle 09:00 e concatena permanenze e spostamenti', () => {
    const stops = [
      makeStop({ title: 'Uffizi', category: 'cultura', plannedDurationMin: 120 }),
      makeStop({
        title: 'Trattoria',
        category: 'cibo',
        plannedDurationMin: 60,
        location: { lat: 43.7731, lng: 11.256 },
      }),
    ];
    const s = computeDaySchedule(stops);

    expect(formatClock(s.entries[0].arrivalMin)).toBe('09:00');
    expect(formatClock(s.entries[0].departureMin)).toBe('11:00');
    // Poche centinaia di metri → tratta a piedi, minimo 5 minuti.
    expect(s.entries[1].travelMode).toBe('walk');
    expect(s.entries[1].travelMin).toBe(5);
    expect(formatClock(s.entries[1].arrivalMin)).toBe('11:05');
    expect(formatClock(s.entries[1].departureMin)).toBe('12:05');
    expect(s.endMin).toBe(s.entries[1].departureMin);
    expect(s.totalVisitMin).toBe(180);
  });

  it('usa la durata tipica di categoria quando manca quella indicata', () => {
    const s = computeDaySchedule([makeStop({ title: 'Belvedere', category: 'panorama' })]);
    expect(s.entries[0].durationMin).toBe(DEFAULT_DURATION_MIN.panorama);
    expect(s.entries[0].durationIsDefault).toBe(true);
  });

  it("rispetta un orario fissato dall'utente e fa scorrere le tappe successive", () => {
    const stops = [
      makeStop({ title: 'Colazione', category: 'cibo', plannedDurationMin: 30 }),
      makeStop({
        title: 'Museo con prenotazione',
        category: 'cultura',
        plannedArrival: '14:00',
        plannedDurationMin: 60,
        location: { lat: 43.776, lng: 11.26 },
      }),
      makeStop({
        title: 'Passeggiata',
        category: 'natura',
        plannedDurationMin: 45,
        location: { lat: 43.777, lng: 11.261 },
      }),
    ];
    const s = computeDaySchedule(stops);

    expect(formatClock(s.entries[1].arrivalMin)).toBe('14:00');
    expect(s.entries[1].arrivalIsPinned).toBe(true);
    expect(s.entries[1].conflict).toBe(false);
    // La terza tappa scorre dopo la seconda: 15:00 + 5 min di spostamento.
    expect(formatClock(s.entries[2].arrivalMin)).toBe('15:05');
  });

  it("segnala il conflitto quando l'orario fissato non è raggiungibile", () => {
    const stops = [
      makeStop({ title: 'Lunga visita', category: 'cultura', plannedDurationMin: 240 }),
      makeStop({
        title: 'Pranzo alle 10',
        category: 'cibo',
        plannedArrival: '10:00',
        location: { lat: 43.7731, lng: 11.256 },
      }),
    ];
    const s = computeDaySchedule(stops);
    expect(s.entries[1].conflict).toBe(true);
    // L'orario mostrato resta quello scelto dall'utente: la UI segnala, non corregge.
    expect(formatClock(s.entries[1].arrivalMin)).toBe('10:00');
  });

  it('accetta un inizio giornata esplicito', () => {
    const s = computeDaySchedule([makeStop({ title: 'Alba', category: 'panorama' })], {
      dayStartMin: 6 * 60,
    });
    expect(formatClock(s.entries[0].arrivalMin)).toBe('06:00');
  });
});

describe('crowdSuggestions', () => {
  const crowd = new EstimatedCrowdProvider();

  it('propone un orario meno affollato per una tappa di punta', () => {
    // Sabato (6): il museo alle 11 è nel picco.
    const stops = [makeStop({ title: 'Museo', category: 'cultura', plannedDurationMin: 60 })];
    const schedule = computeDaySchedule(stops, { dayStartMin: 11 * 60 });
    const [suggestion] = crowdSuggestions(schedule, 6, crowd);

    expect(suggestion).toBeDefined();
    expect(suggestion.currentHour).toBe(11);
    expect(suggestion.suggestedHour).toBeLessThan(11);
    expect(suggestion.improvement).toBeGreaterThan(0);
  });

  it("non tocca le tappe con orario fissato dall'utente", () => {
    const stops = [
      makeStop({ title: 'Museo prenotato', category: 'cultura', plannedArrival: '11:00' }),
    ];
    const schedule = computeDaySchedule(stops);
    expect(crowdSuggestions(schedule, 6, crowd)).toHaveLength(0);
  });

  it("non suggerisce nulla quando l'affollamento è già basso", () => {
    const stops = [makeStop({ title: 'Museo', category: 'cultura' })];
    // Alle 8 la curva cultura è quasi a zero.
    const schedule = computeDaySchedule(stops, { dayStartMin: 8 * 60 });
    expect(crowdSuggestions(schedule, 6, crowd)).toHaveLength(0);
  });

  it('resta dentro la finestra e il numero massimo richiesti', () => {
    const stops = [
      makeStop({ title: 'A', category: 'cultura' }),
      makeStop({ title: 'B', category: 'shopping', location: { lat: 43.775, lng: 11.257 } }),
      makeStop({ title: 'C', category: 'cibo', location: { lat: 43.776, lng: 11.258 } }),
      makeStop({ title: 'D', category: 'panorama', location: { lat: 43.777, lng: 11.259 } }),
    ];
    const schedule = computeDaySchedule(stops, { dayStartMin: 11 * 60 });
    const result = crowdSuggestions(schedule, 6, crowd, { max: 2, windowHours: 2 });

    expect(result.length).toBeLessThanOrEqual(2);
    for (const s of result) {
      expect(Math.abs(s.suggestedHour - s.currentHour)).toBeLessThanOrEqual(2);
      expect(s.suggestedHour).toBeGreaterThanOrEqual(8);
      expect(s.suggestedHour).toBeLessThanOrEqual(22);
    }
  });
});
