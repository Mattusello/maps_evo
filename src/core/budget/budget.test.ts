import { describe, expect, it } from '@jest/globals';

import type { Day, ItineraryWithDetails, Money, Stop } from '../models';
import { computeBudget } from './budget';

let seq = 0;
const uid = (tag: string) => {
  seq += 1;
  return `00000000-0000-4000-8000-${tag}${String(seq).padStart(8, '0')}`;
};

function makeStop(title: string, cost?: Money): Stop {
  return {
    id: uid('5000'),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local',
    dayId: 'd',
    title,
    category: 'cultura',
    location: { lat: 43.77, lng: 11.25 },
    order: 0,
    cost,
  };
}

function makeItinerary(
  dayStops: Stop[][],
  overrides: Partial<ItineraryWithDetails> = {}
): ItineraryWithDetails {
  const days: (Day & { stops: Stop[] })[] = dayStops.map((stops, i) => ({
    id: uid('4000'),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local',
    itineraryId: 'it',
    label: `Giorno ${i + 1}`,
    orderedStopIds: stops.map((s) => s.id),
    stops,
  }));

  return {
    id: uid('3000'),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    syncStatus: 'local',
    title: 'Viaggio',
    ownerId: 'local',
    collaborators: [],
    currency: 'EUR',
    partySize: 1,
    dayIds: days.map((d) => d.id),
    days,
    ...overrides,
  };
}

describe('computeBudget', () => {
  it('somma i costi per giorno e per itinerario', () => {
    const it = makeItinerary([
      [
        makeStop('Museo', { amount: 12, currency: 'EUR' }),
        makeStop('Pranzo', { amount: 18.5, currency: 'EUR' }),
      ],
      [makeStop('Torre', { amount: 9, currency: 'EUR' })],
    ]);
    const b = computeBudget(it);

    expect(b.days[0].perPerson).toBe(30.5);
    expect(b.days[1].perPerson).toBe(9);
    expect(b.perPerson).toBe(39.5);
    expect(b.total).toBe(39.5); // partySize = 1
    expect(b.missingCount).toBe(0);
  });

  it('moltiplica per il numero di partecipanti (split)', () => {
    const it = makeItinerary([[makeStop('Museo', { amount: 12.5, currency: 'EUR' })]], {
      partySize: 4,
    });
    const b = computeBudget(it);

    expect(b.perPerson).toBe(12.5);
    expect(b.total).toBe(50);
    expect(b.days[0].total).toBe(50);
  });

  it('conta le tappe senza costo senza falsare il totale', () => {
    const it = makeItinerary([
      [makeStop('Museo', { amount: 10, currency: 'EUR' }), makeStop('Piazza')],
    ]);
    const b = computeBudget(it);

    expect(b.perPerson).toBe(10);
    expect(b.missingCount).toBe(1);
    expect(b.days[0].items[1].source).toBe('none');
  });

  it('usa il prezzo crowdsourced come ripiego e lo segnala', () => {
    const stop = makeStop('Museo');
    const it = makeItinerary([[stop]]);
    const b = computeBudget(it, { crowdPrices: { [stop.id]: { amount: 14, currency: 'EUR' } } });

    expect(b.perPerson).toBe(14);
    expect(b.days[0].items[0].source).toBe('crowd');
    expect(b.crowdSourcedCount).toBe(1);
    expect(b.missingCount).toBe(0);
  });

  it('dà precedenza al costo indicato rispetto al prezzo crowdsourced', () => {
    const stop = makeStop('Museo', { amount: 20, currency: 'EUR' });
    const it = makeItinerary([[stop]]);
    const b = computeBudget(it, { crowdPrices: { [stop.id]: { amount: 14, currency: 'EUR' } } });

    expect(b.perPerson).toBe(20);
    expect(b.crowdSourcedCount).toBe(0);
  });

  it('esclude dai totali i costi in valuta diversa e li segnala', () => {
    const it = makeItinerary([
      [
        makeStop('Museo', { amount: 10, currency: 'EUR' }),
        makeStop('Souvenir', { amount: 30, currency: 'USD' }),
      ],
    ]);
    const b = computeBudget(it);

    expect(b.perPerson).toBe(10);
    expect(b.foreignCurrencyCount).toBe(1);
    expect(b.days[0].items[1].foreignCurrency).toBe(true);
  });

  it('gestisce un itinerario senza tappe', () => {
    const b = computeBudget(makeItinerary([[]]));
    expect(b.total).toBe(0);
    expect(b.missingCount).toBe(0);
  });

  it('non accumula errori di virgola mobile', () => {
    const it = makeItinerary([
      [
        makeStop('a', { amount: 0.1, currency: 'EUR' }),
        makeStop('b', { amount: 0.2, currency: 'EUR' }),
      ],
    ]);
    expect(computeBudget(it).perPerson).toBe(0.3);
  });
});
