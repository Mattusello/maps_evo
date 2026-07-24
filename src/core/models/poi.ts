/**
 * POI (Point Of Interest) come restituito dal PoiProvider (es. Google Places).
 * Viene messo in cache localmente con `fetchedAt` per gestire la freschezza.
 */
import { z } from 'zod';

import { locationSchema, priceLevelSchema, stopCategorySchema } from './common';

/** Orari di apertura per giorno della settimana (0 = domenica … 6 = sabato). */
export const openingPeriodSchema = z.object({
  /** Minuti dalla mezzanotte, es. 540 = 09:00. */
  open: z.number().int().min(0).max(1440),
  close: z.number().int().min(0).max(1440),
});
export type OpeningPeriod = z.infer<typeof openingPeriodSchema>;

export const openingHoursSchema = z.object({
  /** Chiave = giorno settimana 0..6; valore = fasce di apertura. */
  byWeekday: z.record(z.string(), z.array(openingPeriodSchema)),
  /** Sempre aperto (es. punti panoramici). */
  alwaysOpen: z.boolean().default(false),
});
export type OpeningHours = z.infer<typeof openingHoursSchema>;

export const poiSchema = z.object({
  placeId: z.string(),
  name: z.string(),
  category: stopCategorySchema,
  location: locationSchema,
  address: z.string().optional(),
  openingHours: openingHoursSchema.optional(),
  priceLevel: priceLevelSchema.optional(),
  rating: z.number().min(0).max(5).optional(),
  photos: z.array(z.string()).default([]),
  contacts: z
    .object({ phone: z.string().optional(), website: z.string().url().optional() })
    .optional(),
  /** Quando è stato recuperato dal provider (freschezza cache). */
  fetchedAt: z.string().datetime(),
});
export type Poi = z.infer<typeof poiSchema>;
