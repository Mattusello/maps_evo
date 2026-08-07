import { describe, expect, it } from '@jest/globals';

import {
  decodeShareCode,
  encodeShareCode,
  exportItineraryJson,
  fitsInQr,
  parseShareInput,
  QR_MAX_CHARS,
  SHARE_CODE_VERSION,
  ShareParseError,
  sharedToItineraryDetails,
  summarizeShared,
  toSharedItinerary,
} from './shareCode';
import type { Day, Itinerary, ItineraryWithDetails, Stop } from '../models';

const ISO = '2026-08-01T10:00:00.000Z';

function stop(partial: Partial<Stop> & Pick<Stop, 'id' | 'title'>): Stop {
  return {
    createdAt: ISO,
    updatedAt: ISO,
    deletedAt: null,
    syncStatus: 'local',
    dayId: '00000000-0000-4000-8000-00000000d001',
    category: 'cultura',
    location: { lat: 43.7687654, lng: 11.2559876 },
    order: 0,
    ...partial,
  } as Stop;
}

/** Itinerario di prova: due giorni, tappe con orari, costi, note e link. */
function fixture(): ItineraryWithDetails {
  const days: (Day & { stops: Stop[] })[] = [
    {
      id: '00000000-0000-4000-8000-00000000d001',
      createdAt: ISO,
      updatedAt: ISO,
      deletedAt: null,
      syncStatus: 'local',
      itineraryId: '00000000-0000-4000-8000-00000000a001',
      date: '2026-09-12',
      label: 'Centro storico',
      orderedStopIds: [
        '00000000-0000-4000-8000-00000000f001',
        '00000000-0000-4000-8000-00000000f002',
      ],
      stops: [
        stop({
          id: '00000000-0000-4000-8000-00000000f001',
          title: 'Galleria degli Uffizi',
          plannedArrival: '09:30',
          plannedDurationMin: 120,
          cost: { amount: 25, currency: 'EUR' },
          bookingUrl: 'https://example.org/uffizi',
          notes: 'Prenotare in anticipo',
          order: 0,
        }),
        stop({
          id: '00000000-0000-4000-8000-00000000f002',
          title: 'Trattoria — pranzo',
          category: 'cibo',
          location: { lat: 43.7712345, lng: 11.2501111 },
          plannedDurationMin: 75,
          order: 1,
        }),
      ],
    },
    {
      id: '00000000-0000-4000-8000-00000000d002',
      createdAt: ISO,
      updatedAt: ISO,
      deletedAt: null,
      syncStatus: 'local',
      itineraryId: '00000000-0000-4000-8000-00000000a001',
      orderedStopIds: [],
      stops: [],
    },
  ];

  const itinerary: Itinerary = {
    id: '00000000-0000-4000-8000-00000000a001',
    createdAt: ISO,
    updatedAt: ISO,
    deletedAt: null,
    syncStatus: 'local',
    title: 'Weekend a Firenze',
    description: 'Due giorni tra musei e cucina',
    ownerId: 'user-1',
    collaborators: [{ userId: 'user-1', role: 'owner' }],
    currency: 'EUR',
    partySize: 2,
    dayIds: [days[0].id, days[1].id],
  };

  return { ...itinerary, days };
}

describe('codice di condivisione', () => {
  it('fa il giro completo mantenendo i dati del viaggio', () => {
    const detail = fixture();
    const decoded = decodeShareCode(encodeShareCode(detail));

    expect(summarizeShared(decoded)).toEqual({
      title: 'Weekend a Firenze',
      description: 'Due giorni tra musei e cucina',
      dayCount: 2,
      stopCount: 2,
      currency: 'EUR',
      partySize: 2,
    });
    expect(decoded.v).toBe(SHARE_CODE_VERSION);
    expect(decoded.ds[0].l).toBe('Centro storico');
    expect(decoded.ds[0].d).toBe('2026-09-12');
    expect(decoded.ds[0].s[0]).toMatchObject({
      t: 'Galleria degli Uffizi',
      c: 'cultura',
      h: '09:30',
      d: 120,
      p: 25,
      pc: 'EUR',
      b: 'https://example.org/uffizi',
      n: 'Prenotare in anticipo',
    });
  });

  it('arrotonda le coordinate a 5 decimali (≈1 m) per accorciare il codice', () => {
    const shared = toSharedItinerary(fixture());
    expect(shared.ds[0].s[0].a).toEqual([43.76877, 11.25599]);
  });

  it('omette i campi assenti invece di scrivere null', () => {
    const shared = toSharedItinerary(fixture());
    const lunch = shared.ds[0].s[1];
    expect(lunch).not.toHaveProperty('h');
    expect(lunch).not.toHaveProperty('p');
    expect(shared.ds[1]).not.toHaveProperty('l');
  });

  it('produce un codice url-safe e più corto del JSON completo', () => {
    const detail = fixture();
    const code = encodeShareCode(detail);
    expect(code).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(code.length).toBeLessThan(exportItineraryJson(detail).length);
    expect(fitsInQr(code)).toBe(true);
  });

  it('dichiara quando il codice non sta in un QR inquadrabile', () => {
    expect(fitsInQr('a'.repeat(QR_MAX_CHARS))).toBe(true);
    expect(fitsInQr('a'.repeat(QR_MAX_CHARS + 1))).toBe(false);
  });

  it('ricostruisce un aggregato valido, con id nuovi e ordine coerente', () => {
    const detail = fixture();
    const rebuilt = sharedToItineraryDetails(decodeShareCode(encodeShareCode(detail)), 'user-2');

    expect(rebuilt.id).not.toBe(detail.id);
    expect(rebuilt.ownerId).toBe('user-2');
    expect(rebuilt.collaborators).toEqual([{ userId: 'user-2', role: 'owner' }]);
    expect(rebuilt.dayIds).toEqual(rebuilt.days.map((d) => d.id));

    const day = rebuilt.days[0];
    expect(day.itineraryId).toBe(rebuilt.id);
    expect(day.orderedStopIds).toEqual(day.stops.map((s) => s.id));
    expect(day.stops.map((s) => s.order)).toEqual([0, 1]);
    expect(day.stops[0].dayId).toBe(day.id);
    expect(day.stops[0].title).toBe('Galleria degli Uffizi');
    expect(day.stops[0].cost).toEqual({ amount: 25, currency: 'EUR' });
    expect(day.stops[1].cost).toBeUndefined();
    expect(rebuilt.days[1].stops).toEqual([]);
  });

  it('usa la valuta del viaggio se un costo condiviso non la porta', () => {
    const shared = toSharedItinerary(fixture());
    delete shared.ds[0].s[0].pc;
    const rebuilt = sharedToItineraryDetails(shared, 'user-2');
    expect(rebuilt.days[0].stops[0].cost).toEqual({ amount: 25, currency: 'EUR' });
  });

  it('legge un link, un codice nudo o il JSON completo', () => {
    const detail = fixture();
    const code = encodeShareCode(detail);

    expect(parseShareInput(`mymappa://import?c=${code}`).t).toBe('Weekend a Firenze');
    expect(parseShareInput(`https://mymappa.app/import?utm=x&c=${code}`).t).toBe('Weekend a Firenze');
    expect(parseShareInput(`  ${code}  `).t).toBe('Weekend a Firenze');
    expect(parseShareInput(exportItineraryJson(detail)).t).toBe('Weekend a Firenze');
  });

  it('dal JSON completo ricava le stesse tappe del codice compatto', () => {
    const detail = fixture();
    expect(parseShareInput(exportItineraryJson(detail))).toEqual(toSharedItinerary(detail));
  });

  it('rifiuta testo, JSON e codici non validi con un motivo esplicito', () => {
    for (const bad of ['', '   ', 'questo non è un codice', '{"pippo":1}', 'AAAA']) {
      expect(() => parseShareInput(bad)).toThrow(ShareParseError);
    }
    try {
      parseShareInput('{"pippo":1}');
    } catch (e) {
      expect((e as ShareParseError).reason).toBe('invalid');
    }
  });

  it('rifiuta un formato più recente invece di leggerlo a metà', () => {
    const future = JSON.stringify({ ...toSharedItinerary(fixture()), v: SHARE_CODE_VERSION + 1 });
    try {
      parseShareInput(future);
      throw new Error('doveva lanciare');
    } catch (e) {
      expect(e).toBeInstanceOf(ShareParseError);
      expect((e as ShareParseError).reason).toBe('version');
    }
  });
});
