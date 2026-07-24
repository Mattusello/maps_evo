/**
 * Outbox: coda di operazioni locali da sincronizzare con il backend (Fase 2).
 * In Fase 1 viene popolata ma non svuotata; prepara la sincronizzazione futura.
 */
import { z } from 'zod';

export const outboxOpSchema = z.enum(['create', 'update', 'delete']);
export type OutboxOp = z.infer<typeof outboxOpSchema>;

export const outboxEntitySchema = z.enum(['itinerary', 'day', 'stop', 'priceReport']);
export type OutboxEntity = z.infer<typeof outboxEntitySchema>;

export const outboxEntrySchema = z.object({
  id: z.string().uuid(),
  entityType: outboxEntitySchema,
  entityId: z.string().uuid(),
  op: outboxOpSchema,
  /** Payload serializzato dell'operazione (snapshot dell'entità). */
  payload: z.unknown(),
  createdAt: z.string().datetime(),
});
export type OutboxEntry = z.infer<typeof outboxEntrySchema>;
