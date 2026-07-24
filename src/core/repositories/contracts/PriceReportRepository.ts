/**
 * CONTRATTO per i prezzi crowdsourced. Fase 1/2: locale; Fase 2+: backend condiviso
 * (il valore cresce con la community). Stessa interfaccia in entrambi i casi.
 */
import type { Money, PriceReport } from '../../models';

export type CreatePriceReportInput = {
  stopId?: string;
  placeId?: string;
  price: Money;
  label?: string;
  reportedBy: string;
};

export interface PriceReportRepository {
  /** Report per una tappa o un luogo. */
  list(params: { stopId?: string; placeId?: string }): Promise<PriceReport[]>;
  add(input: CreatePriceReportInput): Promise<PriceReport>;
  /** Voto: +1 (utile) o -1 (non aggiornato). */
  vote(id: string, delta: 1 | -1): Promise<PriceReport>;
}
