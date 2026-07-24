/**
 * PriceReport: prezzo reale inserito/confermato dagli utenti (crowdsourced).
 * Ogni dato ha timestamp e voti → la "freschezza" e l'affidabilità si derivano da qui.
 */
import { z } from 'zod';

import { baseEntitySchema, moneySchema } from './common';

export const priceReportSchema = baseEntitySchema.extend({
  /** Riferimento alla tappa o al POI a cui si riferisce il prezzo. */
  stopId: z.string().uuid().optional(),
  placeId: z.string().optional(),
  price: moneySchema,
  /** Cosa rappresenta il prezzo (ingresso, pasto medio, ecc.). */
  label: z.string().optional(),
  reportedBy: z.string(),
  upvotes: z.number().int().nonnegative().default(0),
  downvotes: z.number().int().nonnegative().default(0),
});
export type PriceReport = z.infer<typeof priceReportSchema>;
