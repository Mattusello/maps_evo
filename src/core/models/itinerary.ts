/**
 * Entità di dominio principali: Collaborator, Stop, Day, Itinerary.
 * Modellate pensando a un'API REST: id UUID lato client, timestamps, ownerId,
 * collaborators[], syncStatus. Giorni e tappe referenziati per id per un riordino stabile.
 */
import { z } from 'zod';

import {
  baseEntitySchema,
  currencySchema,
  locationSchema,
  moneySchema,
  stopCategorySchema,
} from './common';

/** Ruolo di un collaboratore su un itinerario. */
export const collaboratorRoleSchema = z.enum(['owner', 'editor', 'viewer']);
export type CollaboratorRole = z.infer<typeof collaboratorRoleSchema>;

export const collaboratorSchema = z.object({
  userId: z.string(),
  displayName: z.string().optional(),
  role: collaboratorRoleSchema,
});
export type Collaborator = z.infer<typeof collaboratorSchema>;

/** Tappa di un giorno. */
export const stopSchema = baseEntitySchema.extend({
  dayId: z.string().uuid(),
  /** Riferimento al POI del provider, se la tappa nasce da una ricerca. */
  poiRef: z.string().optional(),
  title: z.string().min(1),
  category: stopCategorySchema,
  location: locationSchema,
  /** Orario di arrivo pianificato (ISO time locale, es. "09:30"). */
  plannedArrival: z.string().optional(),
  plannedDurationMin: z.number().int().positive().optional(),
  notes: z.string().optional(),
  /** Costo previsto della tappa (baseline; il prezzo reale vive nei PriceReport). */
  cost: moneySchema.optional(),
  bookingUrl: z.string().url().optional(),
  /** Posizione della tappa nel giorno (ridondante con orderedStopIds, ma comoda). */
  order: z.number().int().nonnegative(),
});
export type Stop = z.infer<typeof stopSchema>;

/** Giorno dell'itinerario. */
export const daySchema = baseEntitySchema.extend({
  itineraryId: z.string().uuid(),
  /** Data del giorno (ISO date, es. "2026-08-12"); opzionale per itinerari senza date fisse. */
  date: z.string().optional(),
  label: z.string().optional(),
  /** Ordine delle tappe nel giorno. */
  orderedStopIds: z.array(z.string().uuid()).default([]),
});
export type Day = z.infer<typeof daySchema>;

/** Itinerario. */
export const itinerarySchema = baseEntitySchema.extend({
  title: z.string().min(1),
  description: z.string().optional(),
  coverImage: z.string().optional(),
  ownerId: z.string(),
  collaborators: z.array(collaboratorSchema).default([]),
  currency: currencySchema.default('EUR'),
  /** Numero di partecipanti, per la divisione del budget. */
  partySize: z.number().int().positive().default(1),
  /** Ordine dei giorni. */
  dayIds: z.array(z.string().uuid()).default([]),
});
export type Itinerary = z.infer<typeof itinerarySchema>;

/**
 * Aggregato completo: itinerario con giorni e tappe risolti.
 * È la forma comoda per la UI; il repository sa comporlo/scomporlo.
 */
export type ItineraryWithDetails = Itinerary & {
  days: (Day & { stops: Stop[] })[];
};

// --- Schemi di input (form) — validati da react-hook-form + zod ---

// Nessun `.default()` qui: i valori iniziali li fornisce il form (defaultValues), così
// il tipo di input e di output coincidono e react-hook-form + zodResolver combaciano.
export const createItineraryInputSchema = z.object({
  title: z.string().min(1, 'Dai un nome al tuo itinerario'),
  description: z.string().optional(),
  currency: currencySchema,
  partySize: z.number().int().positive(),
});
export type CreateItineraryInput = z.infer<typeof createItineraryInputSchema>;
