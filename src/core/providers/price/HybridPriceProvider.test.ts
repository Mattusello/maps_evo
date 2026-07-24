import { describe, expect, it } from '@jest/globals';

import type { PriceReport } from '../../models';
import { HybridPriceProvider } from './HybridPriceProvider';

function report(partial: Partial<PriceReport>): PriceReport {
  const now = new Date().toISOString();
  return {
    id: '00000000-0000-4000-8000-000000000000',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'local',
    stopId: 's1',
    price: { amount: 10, currency: 'EUR' },
    reportedBy: 'u',
    upvotes: 0,
    downvotes: 0,
    ...partial,
  };
}

const provider = new HybridPriceProvider();

describe('HybridPriceProvider', () => {
  it('senza report usa solo la fascia baseline', () => {
    const info = provider.getPriceInfo({ priceLevel: 2, reports: [] });
    expect(info.level).toBe(2);
    expect(info.crowdPrice).toBeUndefined();
  });

  it('sceglie il report con punteggio più alto', () => {
    const info = provider.getPriceInfo({
      reports: [
        report({ price: { amount: 10, currency: 'EUR' }, upvotes: 0 }),
        report({ price: { amount: 20, currency: 'EUR' }, upvotes: 5 }),
      ],
    });
    expect(info.crowdPrice?.amount).toBe(20);
    expect(info.score).toBe(5);
    expect(info.freshnessDays).toBe(0);
  });

  it('calcola la freschezza in giorni', () => {
    const old = new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString();
    const info = provider.getPriceInfo({ reports: [report({ createdAt: old })] });
    expect(info.freshnessDays).toBeGreaterThanOrEqual(39);
  });
});
