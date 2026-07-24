import { describe, expect, it } from '@jest/globals';

import { EstimatedCrowdProvider } from './EstimatedCrowdProvider';

const p = new EstimatedCrowdProvider();

describe('EstimatedCrowdProvider', () => {
  it('la vita notturna è affollata a tarda sera e vuota all’alba', () => {
    expect(p.estimateCrowd('notte', 6, 22).level).toBe('alto');
    expect(p.estimateCrowd('notte', 6, 4).level).toBe('basso');
  });

  it('restituisce sempre source "estimated" e confidence < 1', () => {
    const e = p.estimateCrowd('cultura', 1, 11);
    expect(e.source).toBe('estimated');
    expect(e.confidence).toBeLessThan(1);
    expect(e.intensity).toBeGreaterThanOrEqual(0);
    expect(e.intensity).toBeLessThanOrEqual(1);
  });

  it('la curva ha 24 valori normalizzati 0..1', () => {
    const curve = p.dayCurve('cibo', 6);
    expect(curve).toHaveLength(24);
    expect(Math.max(...curve)).toBeLessThanOrEqual(1);
    expect(Math.min(...curve)).toBeGreaterThanOrEqual(0);
  });
});
