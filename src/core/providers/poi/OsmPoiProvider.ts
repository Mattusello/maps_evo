/**
 * OsmPoiProvider — implementazione GRATUITA del PoiProvider basata su OpenStreetMap.
 * Usa Photon (photon.komoot.io) per autocomplete e reverse geocoding: nessuna chiave API.
 *
 * Limiti onesti: Photon non fornisce orari, priceLevel, foto o rating → questi campi restano
 * indefiniti (la UI li mostra come "non disponibili"). In futuro un GooglePoiProvider dietro la
 * stessa interfaccia potrà arricchirli. Rispettare l'uso corretto del servizio (attribuzione OSM,
 * volumi contenuti in sviluppo).
 */
import type { Location, Poi } from '../../models';
import type { PoiProvider, PoiSuggestion } from '../contracts';
import { mapOsmToCategory } from './osmCategory';

const PHOTON_BASE = 'https://photon.komoot.io';

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
  };
};

function toSuggestion(f: PhotonFeature): PoiSuggestion | null {
  const p = f.properties;
  if (!p.name) return null;
  const [lng, lat] = f.geometry.coordinates;
  const address = [p.street && `${p.street}${p.housenumber ? ' ' + p.housenumber : ''}`, p.city, p.country]
    .filter(Boolean)
    .join(', ');
  return {
    placeId: `${p.osm_type ?? 'N'}${p.osm_id ?? `${lat},${lng}`}`,
    name: p.name,
    category: mapOsmToCategory(p.osm_key, p.osm_value),
    location: { lat, lng },
    address: address || undefined,
  };
}

export class OsmPoiProvider implements PoiProvider {
  async search(
    query: string,
    opts?: { near?: Location; limit?: number; signal?: AbortSignal }
  ): Promise<PoiSuggestion[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const params = new URLSearchParams({ q, lang: 'it', limit: String(opts?.limit ?? 8) });
    if (opts?.near) {
      params.set('lat', String(opts.near.lat));
      params.set('lon', String(opts.near.lng));
    }
    const res = await fetch(`${PHOTON_BASE}/api/?${params.toString()}`, { signal: opts?.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: PhotonFeature[] };
    return (data.features ?? []).map(toSuggestion).filter((s): s is PoiSuggestion => s !== null);
  }

  async reverseGeocode(location: Location): Promise<PoiSuggestion | null> {
    const params = new URLSearchParams({
      lat: String(location.lat),
      lon: String(location.lng),
      lang: 'it',
    });
    const res = await fetch(`${PHOTON_BASE}/reverse/?${params.toString()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: PhotonFeature[] };
    const first = data.features?.[0];
    if (!first) return null;
    const s = toSuggestion(first);
    // Se il punto non ha un nome, restituisci comunque una tappa generica sulle coordinate.
    return s ?? { placeId: `pt${location.lat},${location.lng}`, name: 'Punto sulla mappa', category: 'altro', location };
  }

  /**
   * Photon non espone dettagli ricchi (orari/foto/prezzi). Restituiamo un Poi minimale
   * a partire dai dati di ricerca già noti non è possibile senza il feature originale, quindi
   * qui torniamo null: la UI userà i dati del PoiSuggestion salvati nella tappa.
   */
  async details(_placeId: string): Promise<Poi | null> {
    void _placeId;
    return null;
  }
}
