/**
 * CONTRATTO del trasporto di sincronizzazione: le due sole chiamate che il SyncEngine fa
 * verso il mondo esterno (`docs/BACKEND.md` §4).
 *
 * Sta dietro un'interfaccia per la stessa ragione dei repository e dei provider: il motore
 * si prova con un trasporto finto, e il giorno in cui il protocollo cambiasse (WebSocket,
 * gRPC, un altro backend) cambia solo l'implementazione.
 */
import { z } from 'zod';

import { outboxEntitySchema, outboxOpSchema } from '../models';

/** Operazione inviata al server: è una voce dell'outbox, con il suo id come chiave di idempotenza. */
export const pushOperationSchema = z.object({
  id: z.string(),
  entityType: outboxEntitySchema,
  entityId: z.string(),
  op: outboxOpSchema,
  payload: z.unknown(),
  createdAt: z.string(),
});
export type PushOperation = z.infer<typeof pushOperationSchema>;

/**
 * Esito di una singola operazione:
 * - `applied` — scritta accettata;
 * - `conflict` — il server aveva una versione più recente e la allega in `entity`;
 * - `rejected` — non applicabile (validazione, permessi, entità inesistente): non si riprova.
 */
export const pushResultSchema = z.object({
  id: z.string(),
  status: z.enum(['applied', 'conflict', 'rejected']),
  entity: z.unknown().optional(),
  reason: z.string().optional(),
  message: z.string().optional(),
});
export type PushResult = z.infer<typeof pushResultSchema>;

export const pushResponseSchema = z.object({
  results: z.array(pushResultSchema),
  serverTime: z.string().optional(),
});
export type PushResponse = z.infer<typeof pushResponseSchema>;

export const pullResponseSchema = z.object({
  itineraries: z.array(z.unknown()).default([]),
  days: z.array(z.unknown()).default([]),
  stops: z.array(z.unknown()).default([]),
  priceReports: z.array(z.unknown()).default([]),
  serverTime: z.string().optional(),
  /** Da rimandare come `since` al giro successivo. */
  nextSince: z.string().nullish(),
  hasMore: z.boolean().optional(),
});
export type PullResponse = z.infer<typeof pullResponseSchema>;

export interface SyncTransport {
  /** Manda le operazioni **nell'ordine ricevuto**; risponde con un esito per operazione. */
  push(operations: PushOperation[]): Promise<PushResponse>;
  /** Restituisce ciò che è cambiato dopo `since` (null = prima sincronizzazione). */
  pull(params: { since: string | null; limit?: number }): Promise<PullResponse>;
}

/** Stato della sincronizzazione, persistito sul dispositivo. */
export type SyncState = {
  /** Fine dell'ultima sincronizzazione riuscita (ISO). */
  lastSyncAt: string | null;
  /** Cursore del pull: `updatedAt` dell'ultima entità ricevuta. */
  since: string | null;
};

/** Riepilogo di una sincronizzazione, per la UI e per i test. */
export type SyncReport = {
  /** Operazioni accettate dal server. */
  pushed: number;
  /** Entità sovrascritte dalla versione del server: modifiche locali perse. */
  conflicts: number;
  /** Operazioni scartate dal server (non verranno riprovate). */
  rejected: number;
  /** Entità ricevute e scritte in locale. */
  pulled: number;
  /** Entità ricevute ma illeggibili (forma non valida): saltate, non fatali. */
  skipped: number;
  /** Operazioni ancora in coda alla fine (rete caduta a metà). */
  pending: number;
  /** Motivo per cui la sincronizzazione non è arrivata in fondo, se è successo. */
  error?: string;
};
