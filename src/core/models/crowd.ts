/**
 * CrowdEstimate: stima di affollamento (derivata, NON persistita).
 * Output del CrowdProvider. In UI va sempre mostrato come dato "stimato".
 */
import { z } from 'zod';

export const crowdLevelSchema = z.enum(['basso', 'medio', 'alto']);
export type CrowdLevel = z.infer<typeof crowdLevelSchema>;

export const crowdEstimateSchema = z.object({
  level: crowdLevelSchema,
  /** Valore normalizzato 0..1 utile per grafici/curve. */
  intensity: z.number().min(0).max(1),
  /** Affidabilità della stima 0..1. */
  confidence: z.number().min(0).max(1),
  /** Origine del dato: per l'MVP sempre 'estimated'. */
  source: z.enum(['estimated', 'live']).default('estimated'),
});
export type CrowdEstimate = z.infer<typeof crowdEstimateSchema>;
