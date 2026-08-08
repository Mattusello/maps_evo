import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { PoiProviderError } from '../contracts';
import { OsmPoiProvider } from './OsmPoiProvider';

const provider = new OsmPoiProvider();

/** Sostituisce fetch e registra le URL chiamate. */
function mockFetch(response: { ok: boolean; status?: number; body?: unknown; text?: string }) {
  const calls: string[] = [];
  const fn = jest.fn(async (url: unknown) => {
    calls.push(String(url));
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 400),
      json: async () => response.body ?? {},
      text: async () => response.text ?? '',
    };
  });
  (globalThis as { fetch: unknown }).fetch = fn;
  return calls;
}

const feature = {
  geometry: { coordinates: [12.4964, 41.9028] },
  properties: { osm_id: 1, osm_type: 'N', osm_key: 'tourism', osm_value: 'museum', name: 'Musei Vaticani', city: 'Roma' },
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('OsmPoiProvider', () => {
  it('usa una lingua accettata da Photon (lang=it risponde 400)', async () => {
    const calls = mockFetch({ ok: true, body: { features: [feature] } });
    await provider.search('musei');
    const lang = new URL(calls[0]).searchParams.get('lang');
    expect(['default', 'de', 'en', 'fr']).toContain(lang);
  });

  it('passa il bias geografico quando `near` è noto', async () => {
    const calls = mockFetch({ ok: true, body: { features: [] } });
    await provider.search('musei', { near: { lat: 41.9, lng: 12.5 } });
    const params = new URL(calls[0]).searchParams;
    expect(params.get('lat')).toBe('41.9');
    expect(params.get('lon')).toBe('12.5');
  });

  it('segnala il fallimento della fonte invece di restituire una lista vuota', async () => {
    mockFetch({ ok: false, status: 400, text: '{"lang":"not supported"}' });
    await expect(provider.search('musei')).rejects.toBeInstanceOf(PoiProviderError);
  });

  it('segnala il fallimento anche nel geocoding inverso', async () => {
    mockFetch({ ok: false, status: 503, text: 'unavailable' });
    await expect(provider.reverseGeocode({ lat: 41.9, lng: 12.5 })).rejects.toBeInstanceOf(PoiProviderError);
  });

  it('mappa i risultati in suggerimenti con categoria e coordinate', async () => {
    mockFetch({ ok: true, body: { features: [feature] } });
    const [first] = await provider.search('musei');
    expect(first).toMatchObject({ name: 'Musei Vaticani', location: { lat: 41.9028, lng: 12.4964 } });
  });
});
