import { describe, expect, it } from '@jest/globals';

import type { OpeningHours } from '@/core/models';
import { getOpenStatus } from './openingHours';

// Lunedì 5 gennaio 2026, orari 09:00–18:00.
const monday = (h: number, m = 0) => new Date(2026, 0, 5, h, m);
const hours: OpeningHours = { byWeekday: { '1': [{ open: 540, close: 1080 }] }, alwaysOpen: false };

describe('getOpenStatus', () => {
  it('è aperto durante l’orario', () => {
    const s = getOpenStatus(hours, monday(10));
    expect(s.kind).toBe('open');
    if (s.kind === 'open') {
      expect(s.closesAt).toBe('18:00');
      expect(s.closesInMinutes).toBe(480);
    }
  });

  it('segnala la chiusura imminente', () => {
    const s = getOpenStatus(hours, monday(17, 30));
    expect(s.kind).toBe('open');
    if (s.kind === 'open') expect(s.closesInMinutes).toBe(30);
  });

  it('è chiuso prima dell’apertura e indica quando apre', () => {
    const s = getOpenStatus(hours, monday(8));
    expect(s.kind).toBe('closed');
    if (s.kind === 'closed') expect(s.opensAt).toBe('09:00');
  });

  it('senza orari restituisce sconosciuto', () => {
    expect(getOpenStatus(undefined, monday(10)).kind).toBe('unknown');
  });
});
