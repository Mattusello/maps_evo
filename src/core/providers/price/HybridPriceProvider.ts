/**
 * HybridPriceProvider — strategia ibrida (§5): baseline dalla fascia di prezzo (priceLevel)
 * + prezzi reali crowdsourced. Sceglie il report più affidabile e ne calcola la freschezza.
 */
import type { PriceReport } from '../../models';
import type { PriceInfo, PriceProvider } from '../contracts';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export class HybridPriceProvider implements PriceProvider {
  getPriceInfo({ priceLevel, reports }: { priceLevel?: number; reports: PriceReport[] }): PriceInfo {
    const valid = reports.filter((r) => !r.deletedAt);
    if (valid.length === 0) {
      return { level: priceLevel };
    }

    // Ordina per punteggio (voti netti) e, a parità, per data più recente (createdAt = data report).
    const ranked = [...valid].sort((a, b) => {
      const scoreA = a.upvotes - a.downvotes;
      const scoreB = b.upvotes - b.downvotes;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.createdAt.localeCompare(a.createdAt);
    });
    const best = ranked[0];
    const freshnessDays = Math.max(
      0,
      Math.floor((Date.now() - new Date(best.createdAt).getTime()) / MS_PER_DAY)
    );

    return {
      level: priceLevel,
      crowdPrice: best.price,
      freshnessDays,
      score: best.upvotes - best.downvotes,
    };
  }
}
