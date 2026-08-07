/**
 * La soglia `QR_MAX_CHARS` decide se mostrare il QR o proporre il link. Se fosse troppo
 * generosa `<QRCode>` lancerebbe in pieno foglio di condivisione, o disegnerebbe un reticolo
 * illeggibile. Qui la si verifica contro l'encoder **vero** — `qrcode`, lo stesso che usa
 * react-native-qrcode-svg — e si controlla che un viaggio di dimensioni normali ci stia.
 *
 * Nota: il codice è base64url **misto** di maiuscole e minuscole, quindi il QR lo codifica in
 * modalità byte. Un finto payload di sole maiuscole ingannerebbe la misura, perché l'encoder
 * passerebbe alla modalità alfanumerica, molto più capiente.
 */
import { describe, expect, it } from '@jest/globals';
import QRCode from 'qrcode';

import { encodeShareCode, fitsInQr, QR_MAX_CHARS } from '@/core/sharing/shareCode';
import type { Day, Itinerary, ItineraryWithDetails, Stop } from '@/core/models';

const ISO = '2026-08-01T10:00:00.000Z';
const ECL = 'L'; // stesso livello di correzione usato nel ShareSheet

/** Versione QR oltre la quale il reticolo non è più inquadrabile da uno schermo. */
const MAX_READABLE_VERSION = 26;

/** Prefisso tipico del link profondo, che nel QR viaggia insieme al codice. */
const LINK_PREFIX = 'mymappa://import?c=';

/** Stringa realistica in alfabeto base64url (maiuscole + minuscole → modalità byte). */
function base64ish(length: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[(i * 7 + 3) % alphabet.length];
  return out;
}

function hex(n: number): string {
  return n.toString(16).padStart(12, '0');
}

/**
 * Itinerario sintetico: `days` giorni da `perDay` tappe. `titleLength` conta, perché nel
 * codice i titoli sono la voce di spesa principale: il limite è in caratteri, non in tappe.
 */
function bigItinerary(days: number, perDay: number, titleLength = 21): ItineraryWithDetails {
  const itineraryId = '00000000-0000-4000-8000-00000000a001';
  let counter = 0;
  const dayList: (Day & { stops: Stop[] })[] = Array.from({ length: days }, (_, d) => {
    const dayId = `00000000-0000-4000-8000-${hex(1000 + d)}`;
    const stops: Stop[] = Array.from({ length: perDay }, (_, s) => {
      counter += 1;
      return {
        id: `00000000-0000-4000-8000-${hex(2000 + counter)}`,
        createdAt: ISO,
        updatedAt: ISO,
        deletedAt: null,
        syncStatus: 'local',
        dayId,
        title: `Tappa ${counter} `.padEnd(titleLength, 'o'),
        category: 'cultura',
        location: { lat: 43.76 + s / 1000, lng: 11.25 + d / 1000 },
        plannedArrival: '09:30',
        plannedDurationMin: 90,
        cost: { amount: 12.5, currency: 'EUR' },
        order: s,
      } as Stop;
    });
    return {
      id: dayId,
      createdAt: ISO,
      updatedAt: ISO,
      deletedAt: null,
      syncStatus: 'local',
      itineraryId,
      date: '2026-09-12',
      label: `Giorno ${d + 1}`,
      orderedStopIds: stops.map((s) => s.id),
      stops,
    };
  });

  const itinerary: Itinerary = {
    id: itineraryId,
    createdAt: ISO,
    updatedAt: ISO,
    deletedAt: null,
    syncStatus: 'local',
    title: 'Viaggio di prova',
    ownerId: 'user-1',
    collaborators: [{ userId: 'user-1', role: 'owner' }],
    currency: 'EUR',
    partySize: 2,
    dayIds: dayList.map((d) => d.id),
  };
  return { ...itinerary, days: dayList };
}

describe('capienza del QR', () => {
  it('alla soglia il QR resta entro la versione leggibile', () => {
    const atLimit = QRCode.create(base64ish(QR_MAX_CHARS), { errorCorrectionLevel: ECL });
    expect(atLimit.version).toBeLessThanOrEqual(MAX_READABLE_VERSION);
  });

  it('un carattere oltre la soglia serve già una versione più densa', () => {
    const over = QRCode.create(base64ish(QR_MAX_CHARS + 1), { errorCorrectionLevel: ECL });
    expect(over.version).toBeGreaterThan(MAX_READABLE_VERSION);
  });

  it('oltre la capienza del formato l’encoder rifiuta del tutto', () => {
    expect(() => QRCode.create(base64ish(3000), { errorCorrectionLevel: ECL })).toThrow();
  });

  it('un viaggio normale (3 giorni × 5 tappe) sta nel QR', () => {
    const url = LINK_PREFIX + encodeShareCode(bigItinerary(3, 5));
    expect(fitsInQr(url)).toBe(true);
    expect(QRCode.create(url, { errorCorrectionLevel: ECL }).version).toBeLessThanOrEqual(
      MAX_READABLE_VERSION
    );
  });

  it('un viaggio lungo supera la soglia e la UI propone il link', () => {
    expect(fitsInQr(LINK_PREFIX + encodeShareCode(bigItinerary(5, 6)))).toBe(false);
  });

  it('col nome delle tappe molto lungo il limite arriva prima, a parità di tappe', () => {
    // Documenta dove sta davvero il confine: conta il testo, non il numero di tappe.
    expect(fitsInQr(LINK_PREFIX + encodeShareCode(bigItinerary(3, 5, 21)))).toBe(true);
    expect(fitsInQr(LINK_PREFIX + encodeShareCode(bigItinerary(3, 5, 45)))).toBe(false);
  });
});
