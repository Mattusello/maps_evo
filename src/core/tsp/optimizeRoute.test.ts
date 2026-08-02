import { describe, expect, it } from '@jest/globals';

import { haversineKm, travelMinutes, travelMode } from '../geo/distance';
import { optimizeRoute, type RoutePoint } from './optimizeRoute';

/** Punto comodo: griglia attorno a Firenze, dove 0.01° ≈ 1.1 km. */
const p = (id: string, lat: number, lng: number): RoutePoint => ({
  id,
  location: { lat, lng },
});

describe('haversineKm', () => {
  it('è zero fra un punto e se stesso', () => {
    expect(haversineKm({ lat: 43.77, lng: 11.25 }, { lat: 43.77, lng: 11.25 })).toBe(0);
  });

  it('stima correttamente una distanza nota (Firenze → Pisa ≈ 74 km)', () => {
    const d = haversineKm({ lat: 43.7696, lng: 11.2558 }, { lat: 43.7228, lng: 10.4017 });
    expect(d).toBeGreaterThan(66);
    expect(d).toBeLessThan(74);
  });

  it('è simmetrica', () => {
    const a = { lat: 45.46, lng: 9.19 };
    const b = { lat: 41.9, lng: 12.5 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9);
  });
});

describe('travelMinutes', () => {
  it('a piedi sotto la soglia, motorizzato sopra', () => {
    expect(travelMode(0.5)).toBe('walk');
    expect(travelMode(5)).toBe('transit');
  });

  it('arrotonda a multipli di 5 con un minimo di 5 minuti', () => {
    expect(travelMinutes(0)).toBe(0);
    expect(travelMinutes(0.05)).toBe(5);
    expect(travelMinutes(1) % 5).toBe(0);
    expect(travelMinutes(10)).toBeGreaterThanOrEqual(25);
  });
});

describe('optimizeRoute', () => {
  it('lascia invariati percorsi con meno di 3 punti', () => {
    const res = optimizeRoute([p('a', 43.77, 11.25), p('b', 43.78, 11.26)]);
    expect(res.orderedIds).toEqual(['a', 'b']);
    expect(res.changed).toBe(false);
    expect(res.savedKm).toBe(0);
  });

  it('raddrizza un percorso a zigzag su una linea', () => {
    // Punti allineati ma dati in ordine sparso: l'ordine ottimo è quello geografico.
    const points = [
      p('x0', 43.77, 11.25),
      p('x3', 43.77, 11.28),
      p('x1', 43.77, 11.26),
      p('x2', 43.77, 11.27),
    ];
    const res = optimizeRoute(points);
    expect(res.orderedIds).toEqual(['x0', 'x1', 'x2', 'x3']);
    expect(res.changed).toBe(true);
    expect(res.afterKm).toBeLessThan(res.beforeKm);
    expect(res.savedKm).toBeCloseTo(res.beforeKm - res.afterKm, 9);
  });

  it('mantiene ancorata la prima tappa', () => {
    // 'start' è lontano dal gruppo: senza ancoraggio finirebbe in fondo.
    const points = [
      p('start', 43.8, 11.4),
      p('a', 43.77, 11.25),
      p('b', 43.77, 11.27),
      p('c', 43.77, 11.26),
    ];
    const res = optimizeRoute(points, { anchorFirst: true });
    expect(res.orderedIds[0]).toBe('start');
  });

  it('non peggiora mai la lunghezza del percorso', () => {
    const points = [
      p('a', 43.7696, 11.2558),
      p('b', 43.7731, 11.256),
      p('c', 43.768, 11.253),
      p('d', 43.78, 11.26),
      p('e', 43.765, 11.248),
      p('f', 43.79, 11.27),
    ];
    const res = optimizeRoute(points);
    expect(res.afterKm).toBeLessThanOrEqual(res.beforeKm + 1e-9);
    // Nessuna tappa persa o duplicata.
    expect([...res.orderedIds].sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it("segnala changed=false quando l'ordine è già ottimo", () => {
    const points = [p('a', 43.77, 11.25), p('b', 43.77, 11.26), p('c', 43.77, 11.27)];
    const res = optimizeRoute(points);
    expect(res.changed).toBe(false);
    expect(res.orderedIds).toEqual(['a', 'b', 'c']);
  });
});
