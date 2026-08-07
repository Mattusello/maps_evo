/**
 * Codice di condivisione di un itinerario.
 *
 * Un itinerario esce dall'app in **tre forme**, tutte generate da qui:
 *  - **codice** testuale (base64url) da incollare in chat;
 *  - **link** profondo (`mymappa://import?c=…`, vedi `shareLink.ts`), che è anche ciò che
 *    finisce nel **QR**;
 *  - **JSON** completo, per un backup leggibile.
 *
 * ## Perché il formato è così stretto
 * Il vincolo vero è il QR: la sua capienza è finita e crescendo diventa un reticolo troppo
 * fitto per essere inquadrato da uno schermo (vedi `QR_MAX_CHARS`). Per questo il payload
 * non è il JSON dell'aggregato ma una forma **posizionale**: le tappe sono tuple senza nomi
 * di campo, la categoria è un indice, le coordinate sono **interi** espressi come scarto da
 * un'origine comune. Costa un po' di leggibilità e fa entrare nel QR il triplo delle tappe.
 * Id, timestamp e stato di sync non viaggiano: all'import vengono rigenerati.
 *
 * `v` è la versione del formato: un codice più recente viene **rifiutato con un motivo**,
 * non letto a metà.
 *
 * Tutto qui dentro è puro e testato; la UI mostra codice/QR e delega la scrittura al
 * repository.
 */
import { z } from 'zod';

import {
  currencySchema,
  daySchema,
  itinerarySchema,
  stopCategorySchema,
  stopSchema,
  type Currency,
  type ItineraryWithDetails,
  type Location,
  type Money,
  type StopCategory,
} from '../models';
import { decodeBase64Url, encodeBase64Url } from '../utils/base64';
import { newId } from '../utils/id';
import { formatClock, nowIso, parseClock } from '../utils/time';

/** Versione del formato di condivisione. Da alzare a ogni cambio non retrocompatibile. */
export const SHARE_CODE_VERSION = 1;

/** Nome del parametro che porta il codice nel link profondo. */
export const SHARE_QUERY_PARAM = 'c';

/**
 * Massimo numero di caratteri che mettiamo in un QR.
 *
 * 1367 è la capienza reale in modalità byte con correzione L alla **versione 26** del
 * formato QR: 121×121 moduli, che a ~280 px sullo schermo restano inquadrabili da un
 * telefono. Oltre, il QR esiste ancora (fino a 2953 caratteri) ma diventa un reticolo
 * troppo fitto da leggere: meglio dirlo e proporre il link. Verificato contro l'encoder
 * vero in `features/sharing/qrCapacity.test.ts`.
 */
export const QR_MAX_CHARS = 1367;

/**
 * Ordine delle categorie **nel formato di condivisione**: è parte del protocollo, non un
 * dettaglio. Non riordinare né rimuovere voci (i codici già in giro si romperebbero):
 * eventuali categorie nuove si aggiungono **in coda**. Un test verifica che copra tutte
 * le categorie del modello.
 */
export const SHARED_CATEGORIES = [
  'cultura',
  'cibo',
  'natura',
  'panorama',
  'shopping',
  'notte',
  'alloggio',
  'trasporto',
  'altro',
] as const satisfies readonly StopCategory[];

/** Come sopra: l'ordine è parte del formato. Nuove valute solo in coda. */
export const SHARED_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY'] as const satisfies readonly Currency[];

/** Fattore delle coordinate intere: 1e-5 grado ≈ 1 m, abbastanza per una tappa. */
const COORD_SCALE = 1e5;

// --- Forma normalizzata (quella che vede il resto dell'app) ---

export type SharedStop = {
  title: string;
  category: StopCategory;
  location: Location;
  /** Orario di arrivo in minuti da mezzanotte. */
  arrivalMin?: number;
  durationMin?: number;
  /** Costo a persona, come nel modello. */
  cost?: Money;
  notes?: string;
  bookingUrl?: string;
};

export type SharedDay = { label?: string; date?: string; stops: SharedStop[] };

/** Itinerario ricevuto/da condividere, in forma leggibile. */
export type SharedItinerary = {
  version: number;
  title: string;
  description?: string;
  currency: Currency;
  partySize: number;
  days: SharedDay[];
};

// --- Forma "a filo" (quella che finisce nel codice) ---

/**
 * Tappa: `[titolo, categoria, Δlat, Δlng, arrivo?, durata?, costo?, valuta?, note?, link?]`.
 * I campi assenti sono `null`; quelli in coda si omettono del tutto.
 */
const wireStopSchema = z.array(z.union([z.string(), z.number(), z.null()])).min(4);

/** Giorno: `[etichetta?, data?, tappe]`. */
const wireDaySchema = z.tuple([
  z.string().nullable(),
  z.string().nullable(),
  z.array(wireStopSchema),
]);

const wireItinerarySchema = z.object({
  v: z.number().int().positive(),
  t: z.string().min(1),
  d: z.string().nullish(),
  /** Indice in SHARED_CURRENCIES. */
  c: z.number().int().nonnegative(),
  p: z.number().int().positive(),
  /** Origine delle coordinate, in interi 1e-5. */
  o: z.tuple([z.number().int(), z.number().int()]),
  ds: z.array(wireDaySchema),
});

/** Forma del JSON completo esportato (l'aggregato del repository). */
export const itineraryExportSchema = itinerarySchema.extend({
  days: z.array(daySchema.extend({ stops: z.array(stopSchema).default([]) })).default([]),
});

/** Errore di lettura di un codice/link/JSON condiviso. La UI lo traduce in un messaggio. */
export class ShareParseError extends Error {
  constructor(
    /** `invalid` = illeggibile o incoerente; `version` = formato più recente di questa app. */
    readonly reason: 'invalid' | 'version',
    message: string
  ) {
    super(message);
    this.name = 'ShareParseError';
  }
}

function invalid(what: string): never {
  throw new ShareParseError('invalid', what);
}

/** Rimuove i `null` finali: sono l'assenza di campi facoltativi, non serve scriverli. */
function dropTrailingNulls(tuple: (string | number | null)[]): (string | number | null)[] {
  const out = [...tuple];
  while (out.length > 0 && out[out.length - 1] === null) out.pop();
  return out;
}

// --- Conversioni: aggregato → forma normalizzata ---

/** Aggregato del repository → forma normalizzata condivisibile. */
export function toSharedItinerary(detail: ItineraryWithDetails): SharedItinerary {
  return {
    version: SHARE_CODE_VERSION,
    title: detail.title,
    ...(detail.description !== undefined ? { description: detail.description } : {}),
    currency: detail.currency,
    partySize: detail.partySize,
    days: detail.days.map((day) => ({
      ...(day.label !== undefined ? { label: day.label } : {}),
      ...(day.date !== undefined ? { date: day.date } : {}),
      stops: day.stops.map((stop) => {
        const arrivalMin = parseClock(stop.plannedArrival);
        return {
          title: stop.title,
          category: stop.category,
          location: stop.location,
          ...(arrivalMin !== null ? { arrivalMin } : {}),
          ...(stop.plannedDurationMin !== undefined
            ? { durationMin: stop.plannedDurationMin }
            : {}),
          ...(stop.cost !== undefined ? { cost: stop.cost } : {}),
          ...(stop.notes !== undefined ? { notes: stop.notes } : {}),
          ...(stop.bookingUrl !== undefined ? { bookingUrl: stop.bookingUrl } : {}),
        };
      }),
    })),
  };
}

/**
 * Forma normalizzata → aggregato pronto per `importItinerary`.
 * Id e timestamp sono nuovi: l'itinerario ricevuto è una **copia** di chi lo importa, non un
 * documento condiviso (la collaborazione vera arriverà col backend).
 */
export function sharedToItineraryDetails(
  shared: SharedItinerary,
  ownerId: string
): ItineraryWithDetails {
  const now = nowIso();
  const itineraryId = newId();

  const days = shared.days.map((day) => {
    const dayId = newId();
    const stops = day.stops.map((stop, index) =>
      stopSchema.parse({
        id: newId(),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'pending' as const,
        dayId,
        title: stop.title,
        category: stop.category,
        location: stop.location,
        plannedArrival: stop.arrivalMin !== undefined ? formatClock(stop.arrivalMin) : undefined,
        plannedDurationMin: stop.durationMin,
        notes: stop.notes,
        bookingUrl: stop.bookingUrl,
        cost: stop.cost,
        order: index,
      })
    );
    return {
      ...daySchema.parse({
        id: dayId,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncStatus: 'pending' as const,
        itineraryId,
        date: day.date,
        label: day.label,
        orderedStopIds: stops.map((s) => s.id),
      }),
      stops,
    };
  });

  return {
    ...itinerarySchema.parse({
      id: itineraryId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending' as const,
      title: shared.title,
      description: shared.description,
      ownerId,
      collaborators: [{ userId: ownerId, role: 'owner' as const }],
      currency: shared.currency,
      partySize: shared.partySize,
      dayIds: days.map((d) => d.id),
    }),
    days,
  };
}

// --- Conversioni: forma normalizzata ↔ forma a filo ---

/** Origine delle coordinate: la prima tappa disponibile (0,0 se l'itinerario è vuoto). */
function originOf(shared: SharedItinerary): [number, number] {
  for (const day of shared.days) {
    const first = day.stops[0];
    if (first) {
      return [
        Math.round(first.location.lat * COORD_SCALE),
        Math.round(first.location.lng * COORD_SCALE),
      ];
    }
  }
  return [0, 0];
}

function toWire(shared: SharedItinerary): z.infer<typeof wireItinerarySchema> {
  const origin = originOf(shared);
  return {
    v: SHARE_CODE_VERSION,
    t: shared.title,
    ...(shared.description !== undefined ? { d: shared.description } : {}),
    c: SHARED_CURRENCIES.indexOf(shared.currency),
    p: shared.partySize,
    o: origin,
    ds: shared.days.map((day) => [
      day.label ?? null,
      day.date ?? null,
      day.stops.map((stop) =>
        dropTrailingNulls([
          stop.title,
          SHARED_CATEGORIES.indexOf(stop.category),
          Math.round(stop.location.lat * COORD_SCALE) - origin[0],
          Math.round(stop.location.lng * COORD_SCALE) - origin[1],
          stop.arrivalMin ?? null,
          stop.durationMin ?? null,
          stop.cost?.amount ?? null,
          stop.cost && stop.cost.currency !== shared.currency
            ? SHARED_CURRENCIES.indexOf(stop.cost.currency)
            : null,
          stop.notes ?? null,
          stop.bookingUrl ?? null,
        ])
      ),
    ]),
  };
}

/** Legge una posizione facoltativa della tupla, con il tipo atteso. */
function at(tuple: (string | number | null)[], index: number): string | number | null {
  return index < tuple.length ? tuple[index] : null;
}

function numberAt(tuple: (string | number | null)[], index: number): number | undefined {
  const value = at(tuple, index);
  if (value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid('Numero non valido');
  return value;
}

function stringAt(tuple: (string | number | null)[], index: number): string | undefined {
  const value = at(tuple, index);
  if (value === null) return undefined;
  if (typeof value !== 'string') invalid('Testo non valido');
  return value;
}

function fromWire(wire: z.infer<typeof wireItinerarySchema>): SharedItinerary {
  const currency = SHARED_CURRENCIES[wire.c];
  if (!currency) invalid('Valuta sconosciuta');
  const [originLat, originLng] = wire.o;

  return {
    version: wire.v,
    title: wire.t,
    ...(wire.d ? { description: wire.d } : {}),
    currency,
    partySize: wire.p,
    days: wire.ds.map(([label, date, stops]) => ({
      ...(label !== null ? { label } : {}),
      ...(date !== null ? { date } : {}),
      stops: stops.map((tuple) => {
        const title = tuple[0];
        const categoryIndex = tuple[1];
        if (typeof title !== 'string' || !title) invalid('Tappa senza titolo');
        if (typeof categoryIndex !== 'number') invalid('Categoria non valida');
        const category = SHARED_CATEGORIES[categoryIndex];
        if (!category) invalid('Categoria sconosciuta');

        const dLat = numberAt(tuple, 2);
        const dLng = numberAt(tuple, 3);
        if (dLat === undefined || dLng === undefined) invalid('Tappa senza posizione');

        const amount = numberAt(tuple, 6);
        const costCurrencyIndex = numberAt(tuple, 7);
        const costCurrency =
          costCurrencyIndex === undefined ? currency : SHARED_CURRENCIES[costCurrencyIndex];
        if (!costCurrency) invalid('Valuta sconosciuta');

        const location = {
          lat: (originLat + dLat) / COORD_SCALE,
          lng: (originLng + dLng) / COORD_SCALE,
        };
        if (location.lat < -90 || location.lat > 90 || location.lng < -180 || location.lng > 180) {
          invalid('Coordinate fuori scala');
        }

        const arrivalMin = numberAt(tuple, 4);
        const durationMin = numberAt(tuple, 5);
        const notes = stringAt(tuple, 8);
        const bookingUrl = stringAt(tuple, 9);

        return {
          title,
          category,
          location,
          ...(arrivalMin !== undefined ? { arrivalMin } : {}),
          ...(durationMin !== undefined ? { durationMin } : {}),
          ...(amount !== undefined ? { cost: { amount, currency: costCurrency } } : {}),
          ...(notes !== undefined ? { notes } : {}),
          ...(bookingUrl !== undefined ? { bookingUrl } : {}),
        };
      }),
    })),
  };
}

// --- Codice ---

/** Itinerario → codice testuale da incollare (base64url, senza spazi né padding). */
export function encodeShareCode(detail: ItineraryWithDetails): string {
  return encodeBase64Url(JSON.stringify(toWire(toSharedItinerary(detail))));
}

/** Codice testuale → itinerario. Lancia `ShareParseError` se non è leggibile. */
export function decodeShareCode(code: string): SharedItinerary {
  let json: string;
  try {
    json = decodeBase64Url(code);
  } catch {
    throw new ShareParseError('invalid', 'Codice non leggibile');
  }
  return parseSharedJson(json);
}

/** JSON (forma a filo o export completo) → itinerario validato. */
function parseSharedJson(json: string): SharedItinerary {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new ShareParseError('invalid', 'JSON non valido');
  }

  // Forma a filo: riconoscibile dalla versione.
  if (raw && typeof raw === 'object' && 'v' in raw) {
    const version = (raw as { v: unknown }).v;
    if (typeof version === 'number' && version > SHARE_CODE_VERSION) {
      throw new ShareParseError('version', `Formato ${version} più recente di questa app`);
    }
    const parsed = wireItinerarySchema.safeParse(raw);
    if (!parsed.success) throw new ShareParseError('invalid', 'Contenuto non valido');
    return fromWire(parsed.data);
  }

  // JSON completo esportato dall'app.
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

  // Link: si estrae il parametro del codice con una regex e non con `URL`, perché uno
  // schema custom come `mymappa://` non è parsato allo stesso modo su tutte le piattaforme.
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

/** Riepilogo per l'anteprima prima dell'import. */
export function summarizeShared(shared: SharedItinerary): {
  title: string;
  description?: string;
  dayCount: number;
  stopCount: number;
  currency: Currency;
  partySize: number;
} {
  return {
    title: shared.title,
    ...(shared.description !== undefined ? { description: shared.description } : {}),
    dayCount: shared.days.length,
    stopCount: shared.days.reduce((n, d) => n + d.stops.length, 0),
    currency: shared.currency,
    partySize: shared.partySize,
  };
}

/**
 * Il contenuto sta in un QR inquadrabile? Va passato **ciò che finisce nel QR** (il link,
 * non il solo codice): il prefisso occupa spazio anche lui.
 */
export function fitsInQr(qrValue: string): boolean {
  return qrValue.length <= QR_MAX_CHARS;
}

/** Elenco delle categorie del modello, per il test di copertura del formato. */
export const MODEL_CATEGORIES = stopCategorySchema.options;
