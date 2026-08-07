/**
 * Codice di condivisione di un itinerario.
 *
 * Un itinerario esce dall'app in **tre forme**, tutte generate da qui:
 *  - **codice** testuale (base64url compatto) da incollare in chat;
 *  - **link** profondo (`mymappa://import?c=…`, vedi `shareLink.ts`);
 *  - **JSON** completo, per un backup leggibile.
 *
 * Il formato del codice è volutamente **compatto** (chiavi di una lettera, coordinate a 5
 * decimali ≈ 1 m) perché deve stare in un QR: il JSON completo dell'itinerario, con id e
 * timestamp, sarebbe grande il triplo e quei campi al momento dell'import vengono comunque
 * rigenerati. Il campo `v` è la versione del formato: un codice di una versione futura viene
 * rifiutato in modo esplicito invece di essere letto a metà.
 *
 * Tutto qui dentro è **puro e testato**: la UI si limita a mostrare codice/QR e a chiamare
 * `importItinerary` del repository.
 */
import { z } from 'zod';

import {
  currencySchema,
  daySchema,
  itinerarySchema,
  stopCategorySchema,
  stopSchema,
  type ItineraryWithDetails,
} from '../models';
import { decodeBase64Url, encodeBase64Url } from '../utils/base64';
import { newId } from '../utils/id';
import { nowIso } from '../utils/time';

/** Versione del formato di condivisione. Da alzare a ogni cambio non retrocompatibile. */
export const SHARE_CODE_VERSION = 1;

/** Nome del parametro che porta il codice nel link profondo. */
export const SHARE_QUERY_PARAM = 'c';

/**
 * Limite prudenziale di caratteri per il QR. Un QR arriva fino a ~2900 byte, ma oltre questa
 * soglia diventa così denso da non essere inquadrabile da uno schermo: sopra il limite la UI
 * propone il link invece di mostrare un codice illeggibile.
 */
export const QR_MAX_CHARS = 1200;

// --- Formato compatto ---

const sharedStopSchema = z.object({
  /** title */
  t: z.string().min(1),
  /** category */
  c: stopCategorySchema,
  /** location [lat, lng] */
  a: z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]),
  /** plannedArrival "HH:MM" */
  h: z.string().optional(),
  /** plannedDurationMin */
  d: z.number().int().positive().optional(),
  /** cost.amount (a persona) */
  p: z.number().nonnegative().optional(),
  /** cost.currency */
  pc: currencySchema.optional(),
  /** notes */
  n: z.string().optional(),
  /** bookingUrl */
  b: z.string().url().optional(),
});

const sharedDaySchema = z.object({
  /** label */
  l: z.string().optional(),
  /** date "YYYY-MM-DD" */
  d: z.string().optional(),
  /** stops */
  s: z.array(sharedStopSchema).default([]),
});

export const sharedItinerarySchema = z.object({
  /** versione del formato */
  v: z.number().int().positive(),
  /** title */
  t: z.string().min(1),
  /** description */
  d: z.string().optional(),
  /** currency */
  c: currencySchema,
  /** partySize */
  p: z.number().int().positive(),
  /** days */
  ds: z.array(sharedDaySchema).default([]),
});

/** Itinerario nella forma compatta che viaggia nel codice/QR/link. */
export type SharedItinerary = z.infer<typeof sharedItinerarySchema>;

/** Forma del JSON completo esportato (l'aggregato del repository). */
export const itineraryExportSchema = itinerarySchema.extend({
  days: z.array(daySchema.extend({ stops: z.array(stopSchema).default([]) })).default([]),
});

/** Errore di lettura di un codice/link/JSON condiviso. La UI lo traduce in un messaggio. */
export class ShareParseError extends Error {
  constructor(
    /** Chiave i18n del motivo: `invalid` (illeggibile) o `version` (formato più recente). */
    readonly reason: 'invalid' | 'version',
    message: string
  ) {
    super(message);
    this.name = 'ShareParseError';
  }
}

/** Coordinate a 5 decimali: ~1 m, abbastanza per una tappa e molto più corto. */
function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

/** Omette le chiavi con valore `undefined`, così non finiscono nel JSON come `null`. */
function compact<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

// --- Conversioni ---

/** Aggregato del repository → forma compatta condivisibile. */
export function toSharedItinerary(detail: ItineraryWithDetails): SharedItinerary {
  return compact({
    v: SHARE_CODE_VERSION,
    t: detail.title,
    d: detail.description,
    c: detail.currency,
    p: detail.partySize,
    ds: detail.days.map((day) =>
      compact({
        l: day.label,
        d: day.date,
        s: day.stops.map((stop) =>
          compact({
            t: stop.title,
            c: stop.category,
            a: [round5(stop.location.lat), round5(stop.location.lng)] as [number, number],
            h: stop.plannedArrival,
            d: stop.plannedDurationMin,
            p: stop.cost?.amount,
            pc: stop.cost?.currency,
            n: stop.notes,
            b: stop.bookingUrl,
          })
        ),
      })
    ),
  });
}

/**
 * Forma compatta → aggregato pronto per `importItinerary`.
 * Id e timestamp sono nuovi: l'itinerario ricevuto è una **copia** di chi lo importa, non un
 * documento condiviso (la collaborazione in tempo reale arriverà col backend).
 */
export function sharedToItineraryDetails(
  shared: SharedItinerary,
  ownerId: string
): ItineraryWithDetails {
  const now = nowIso();
  const itineraryId = newId();

  const days = shared.ds.map((day) => {
    const dayId = newId();
    const stops = day.s.map((stop, index) =>
      stopSchema.parse(
        compact({
          id: newId(),
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          syncStatus: 'pending' as const,
          dayId,
          title: stop.t,
          category: stop.c,
          location: { lat: stop.a[0], lng: stop.a[1] },
          plannedArrival: stop.h,
          plannedDurationMin: stop.d,
          notes: stop.n,
          bookingUrl: stop.b,
          cost: stop.p !== undefined ? { amount: stop.p, currency: stop.pc ?? shared.c } : undefined,
          order: index,
        })
      )
    );
    return {
      ...daySchema.parse(
        compact({
          id: dayId,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          syncStatus: 'pending' as const,
          itineraryId,
          date: day.d,
          label: day.l,
          orderedStopIds: stops.map((s) => s.id),
        })
      ),
      stops,
    };
  });

  return {
    ...itinerarySchema.parse(
      compact({
        id: itineraryId,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'pending' as const,
        title: shared.t,
        description: shared.d,
        ownerId,
        collaborators: [{ userId: ownerId, role: 'owner' as const }],
        currency: shared.c,
        partySize: shared.p,
        dayIds: days.map((d) => d.id),
      })
    ),
    days,
  };
}

// --- Codice ---

/** Itinerario → codice testuale da incollare (base64url, senza spazi né padding). */
export function encodeShareCode(detail: ItineraryWithDetails): string {
  return encodeBase64Url(JSON.stringify(toSharedItinerary(detail)));
}

/** Codice testuale → itinerario compatto. Lancia `ShareParseError` se non è leggibile. */
export function decodeShareCode(code: string): SharedItinerary {
  let json: string;
  try {
    json = decodeBase64Url(code);
  } catch {
    throw new ShareParseError('invalid', 'Codice non leggibile');
  }
  return parseSharedJson(json);
}

/** JSON (compatto o completo) → itinerario compatto validato. */
function parseSharedJson(json: string): SharedItinerary {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new ShareParseError('invalid', 'JSON non valido');
  }

  // Formato compatto: riconoscibile dalla versione.
  if (raw && typeof raw === 'object' && 'v' in raw) {
    const version = (raw as { v: unknown }).v;
    if (typeof version === 'number' && version > SHARE_CODE_VERSION) {
      throw new ShareParseError('version', `Formato ${version} più recente di questa app`);
    }
    const parsed = sharedItinerarySchema.safeParse(raw);
    if (!parsed.success) throw new ShareParseError('invalid', 'Contenuto non valido');
    return parsed.data;
  }

  // JSON completo esportato dall'app: lo riportiamo alla forma compatta.
  const full = itineraryExportSchema.safeParse(raw);
  if (!full.success) throw new ShareParseError('invalid', 'Contenuto non riconosciuto');
  return toSharedItinerary(full.data as ItineraryWithDetails);
}

/**
 * Legge qualunque cosa l'utente incolli: un **link** (`…/import?c=CODICE`), il **codice**
 * nudo, o il **JSON** completo. Un solo campo di testo, tre formati accettati.
 */
export function parseShareInput(input: string): SharedItinerary {
  const text = input.trim();
  if (!text) throw new ShareParseError('invalid', 'Testo vuoto');

  // JSON incollato direttamente.
  if (text.startsWith('{')) return parseSharedJson(text);

  // Link: estrae il parametro del codice (regex, non `URL`, perché uno schema custom
  // come `mymappa://` non è parsato in modo uniforme su tutte le piattaforme).
  const fromLink = new RegExp(`[?&]${SHARE_QUERY_PARAM}=([A-Za-z0-9\\-_]+)`).exec(text);
  if (fromLink) return decodeShareCode(fromLink[1]);

  // Codice nudo: niente spazi, solo alfabeto base64url.
  if (/^[A-Za-z0-9\-_]+={0,2}$/.test(text)) return decodeShareCode(text);

  throw new ShareParseError('invalid', 'Formato non riconosciuto');
}

/** JSON completo e leggibile, per backup o invio a mano. */
export function exportItineraryJson(detail: ItineraryWithDetails): string {
  return JSON.stringify(detail, null, 2);
}

/** Riepilogo di un itinerario ricevuto, per l'anteprima prima dell'import. */
export function summarizeShared(shared: SharedItinerary): {
  title: string;
  description?: string;
  dayCount: number;
  stopCount: number;
  currency: SharedItinerary['c'];
  partySize: number;
} {
  return {
    title: shared.t,
    description: shared.d,
    dayCount: shared.ds.length,
    stopCount: shared.ds.reduce((n, d) => n + d.s.length, 0),
    currency: shared.c,
    partySize: shared.p,
  };
}

/** Il codice sta in un QR inquadrabile? Sopra la soglia la UI propone solo il link. */
export function fitsInQr(code: string): boolean {
  return code.length <= QR_MAX_CHARS;
}
