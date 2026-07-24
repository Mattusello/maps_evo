/**
 * Tipi comuni a tutte le entità. Ogni entità porta: id (UUID lato client per merge futuro),
 * timestamps ISO, e `syncStatus` per la sincronizzazione con il backend (Fase 2).
 */
import { z } from 'zod';

/** Stato di sincronizzazione con il backend. */
export const syncStatusSchema = z.enum(['local', 'pending', 'synced', 'conflict']);
export type SyncStatus = z.infer<typeof syncStatusSchema>;

/** Campi base di ogni entità persistita. */
export const baseEntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /** Soft-delete: valorizzato quando l'entità è cancellata (utile per il sync). */
  deletedAt: z.string().datetime().nullable().default(null),
  syncStatus: syncStatusSchema.default('local'),
});
export type BaseEntity = z.infer<typeof baseEntitySchema>;

/** Coordinate geografiche. */
export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type Location = z.infer<typeof locationSchema>;

/** Valuta ISO 4217 (sottoinsieme comune, estendibile). */
export const currencySchema = z.enum(['EUR', 'USD', 'GBP', 'CHF', 'JPY']);
export type Currency = z.infer<typeof currencySchema>;

/** Importo monetario. */
export const moneySchema = z.object({
  amount: z.number().nonnegative(),
  currency: currencySchema,
});
export type Money = z.infer<typeof moneySchema>;

/**
 * Categorie di tappa/POI. Allineate ai "colori di linea" in `ui/theme/palette.ts`.
 */
export const stopCategorySchema = z.enum([
  'cultura',
  'cibo',
  'natura',
  'panorama',
  'shopping',
  'notte',
  'alloggio',
  'trasporto',
  'altro',
]);
export type StopCategory = z.infer<typeof stopCategorySchema>;

/** Fascia di prezzo baseline (stile Google priceLevel: € – €€€€). */
export const priceLevelSchema = z.number().int().min(0).max(4);
export type PriceLevel = z.infer<typeof priceLevelSchema>;
