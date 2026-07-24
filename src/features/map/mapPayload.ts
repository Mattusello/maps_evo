import type { MapMarker, MapOutMessage } from './MapCanvas.types';

/** Costruisce il messaggio 'setData' per la mappa: marker + linea-percorso ordinata. */
export function buildSetData(
  markers: MapMarker[],
  routeColor: string,
  center?: { lat: number; lng: number },
  fit = true
) {
  const ordered = markers.filter((m) => m.index > 0).sort((a, b) => a.index - b.index);
  return {
    type: 'setData' as const,
    markers,
    route: ordered.map((m) => [m.lat, m.lng] as [number, number]),
    routeColor,
    center,
    fit: fit && markers.length > 0,
  };
}

/** Interpreta un messaggio grezzo (stringa JSON) proveniente dalla mappa. */
export function parseMapMessage(raw: unknown): MapOutMessage | null {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (data && typeof data.type === 'string') return data as MapOutMessage;
  } catch {
    // ignora messaggi non nostri (es. da estensioni del browser)
  }
  return null;
}
