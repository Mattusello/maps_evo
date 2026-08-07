import { describe, expect, it } from '@jest/globals';

import {
  decodeShareCode,
  encodeShareCode,
  exportItineraryJson,
  fitsInQr,
  MODEL_CATEGORIES,
  parseShareInput,
  QR_MAX_CHARS,
  SHARE_CODE_VERSION,
  SHARED_CATEGORIES,
  ShareParseError,
  sharedToItineraryDetails,
  summarizeShared,
  toSharedItinerary,
} from './shareCode';
import { decodeBase64Url, encodeBase64Url } from '../utils/base64';
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

/** Il JSON che viaggia dentro il codice: serve per ispezionare la forma "a filo". */
function wireOf(detail: ItineraryWithDetails): {
  v: number;
  c: number;
  o: [number, number];
  ds: [string | null, string | null, (string | number | null)[][]][];
} {
  return JSON.parse(decodeBase64Url(encodeShareCode(detail)));
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
    expect(decoded.version).toBe(SHARE_CODE_VERSION);
    expect(decoded.days[0].label).toBe('Centro storico');
    expect(decoded.days[0].date).toBe('2026-09-12');
    expect(decoded.days[0].stops[0]).toEqual({
      title: 'Galleria degli Uffizi',
      category: 'cultura',
      location: { lat: 43.76877, lng: 11.25599 },
      arrivalMin: 570,
      durationMin: 120,
      cost: { amount: 25, currency: 'EUR' },
      notes: 'Prenotare in anticipo',
      bookingUrl: 'https://example.org/uffizi',
    });
    expect(decoded.days[1].stops).toEqual([]);
  });

  it('manda le coordinate come scarto intero da un’origine comune', () => {
    const wire = wireOf(fixture());
    // Origine = prima tappa, quindi il suo scarto è 0.
    expect(wire.o).toEqual([4376877, 1125599]);
    expect(wire.ds[0][2][0].slice(2, 4)).toEqual([0, 0]);
    // Seconda tappa: poco più in là, quindi interi corti invece di due decimali lunghi.
    expect(wire.ds[0][2][1].slice(2, 4)).toEqual([246, -588]);
  });

  it('omette i campi in coda che non ci sono', () => {
    const wire = wireOf(fixture());
    const [uffizi, trattoria] = wire.ds[0][2];
    // Gli Uffizi hanno tutto: 10 posizioni (la valuta del costo coincide → resta null).
    expect(uffizi).toHaveLength(10);
    expect(uffizi[7]).toBeNull();
    // La trattoria non ha orario, costo, note né link: la tupla si ferma alla durata.
    expect(trattoria).toHaveLength(6);
    expect(trattoria[4]).toBeNull();
  });

  it('manda categoria e valuta come indici del formato', () => {
    const wire = wireOf(fixture());
    expect(wire.c).toBe(0); // EUR
    expect(wire.ds[0][2][0][1]).toBe(SHARED_CATEGORIES.indexOf('cultura'));
    expect(wire.ds[0][2][1][1]).toBe(SHARED_CATEGORIES.indexOf('cibo'));
  });

  it('il formato copre tutte le categorie del modello', () => {
    // Se il modello guadagna una categoria, va aggiunta IN CODA a SHARED_CATEGORIES.
    expect([...SHARED_CATEGORIES].sort()).toEqual([...MODEL_CATEGORIES].sort());
  });

  it('produce un codice url-safe e molto più corto del JSON completo', () => {
    const detail = fixture();
    const code = encodeShareCode(detail);
    expect(code).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(code.length).toBeLessThan(exportItineraryJson(detail).length / 3);
    expect(fitsInQr(code)).toBe(true);
  });

  it('applica la soglia del QR a ciò che il QR contiene', () => {
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
    expect(day.stops[0].plannedArrival).toBe('09:30');
    expect(day.stops[0].cost).toEqual({ amount: 25, currency: 'EUR' });
    expect(day.stops[1].cost).toBeUndefined();
    expect(day.stops[1].plannedArrival).toBeUndefined();
    expect(rebuilt.days[1].stops).toEqual([]);
  });

  it('conserva un costo in valuta diversa da quella del viaggio', () => {
    const detail = fixture();
    detail.days[0].stops[1].cost = { amount: 30, currency: 'CHF' };
    const decoded = decodeShareCode(encodeShareCode(detail));
    expect(decoded.days[0].stops[1].cost).toEqual({ amount: 30, currency: 'CHF' });
  });

  it('conserva un costo zero (gratis) invece di scambiarlo per assenza', () => {
    const detail = fixture();
    detail.days[0].stops[1].cost = { amount: 0, currency: 'EUR' };
    const decoded = decodeShareCode(encodeShareCode(detail));
    expect(decoded.days[0].stops[1].cost).toEqual({ amount: 0, currency: 'EUR' });
  });

  it('conserva la mezzanotte come orario, non come campo vuoto', () => {
    const detail = fixture();
    detail.days[0].stops[1].plannedArrival = '00:00';
    const decoded = decodeShareCode(encodeShareCode(detail));
    expect(decoded.days[0].stops[1].arrivalMin).toBe(0);
    expect(sharedToItineraryDetails(decoded, 'u').days[0].stops[1].plannedArrival).toBe('00:00');
  });

  it('legge un link, un codice nudo o il JSON completo', () => {
    const detail = fixture();
    const code = encodeShareCode(detail);

    expect(parseShareInput(`mymappa://import?c=${code}`).title).toBe('Weekend a Firenze');
    expect(parseShareInput(`https://mymappa.app/import?utm=x&c=${code}`).title).toBe(
      'Weekend a Firenze'
    );
    expect(parseShareInput(`  ${code}  `).title).toBe('Weekend a Firenze');
    expect(parseShareInput(exportItineraryJson(detail)).title).toBe('Weekend a Firenze');
  });

  it('dal JSON completo ricava lo stesso itinerario del codice compatto', () => {
    const detail = fixture();
    expect(parseShareInput(exportItineraryJson(detail))).toEqual(toSharedItinerary(detail));
  });

  it('rifiuta testo, JSON e codici non validi con un motivo esplicito', () => {
    for (const bad of ['', '   ', 'questo non è un codice', '{"pippo":1}', 'AAAA']) {
      expect(() => parseShareInput(bad)).toThrow(ShareParseError);
    }
    try {
      parseShareInput('{"pippo":1}');
      throw new Error('doveva lanciare');
    } catch (e) {
      expect((e as ShareParseError).reason).toBe('invalid');
    }
  });

  it('rifiuta una categoria che questa versione non conosce', () => {
    const wire = wireOf(fixture());
    wire.ds[0][2][0][1] = 99;
    expect(() => parseShareInput(encodeBase64Url(JSON.stringify(wire)))).toThrow(ShareParseError);
  });

  it('rifiuta coordinate fuori scala invece di piazzare tappe assurde', () => {
    const wire = wireOf(fixture());
    wire.ds[0][2][0][2] = 99_000_000;
    expect(() => parseShareInput(encodeBase64Url(JSON.stringify(wire)))).toThrow(ShareParseError);
  });

  it('rifiuta un formato più recente invece di leggerlo a metà', () => {
    const wire = { ...wireOf(fixture()), v: SHARE_CODE_VERSION + 1 };
    try {
      parseShareInput(encodeBase64Url(JSON.stringify(wire)));
      throw new Error('doveva lanciare');
    } catch (e) {
      expect(e).toBeInstanceOf(ShareParseError);
      expect((e as ShareParseError).reason).toBe('version');
    }
  });
});
