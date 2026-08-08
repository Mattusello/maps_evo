/**
 * CONTRATTI dei provider di dati (§5). Disaccoppiano la UI dalle fonti (OSM, Google, …):
 * cambiare fonte = cambiare implementazione dietro queste interfacce, senza toccare le schermate.
 */
import type {
  CrowdEstimate,
  CrowdLevel,
  Location,
  Money,
  Poi,
  PriceLevel,
  PriceReport,
  StopCategory,
} from '../../models';

// --- POI ---------------------------------------------------------------

/** Suggerimento di ricerca POI (autocomplete). */
export type PoiSuggestion = {
  placeId: string;
  name: string;
  category: StopCategory;
  location: Location;
  address?: string;
};

/**
 * Fonte non raggiungibile o risposta non valida. Distingue "il servizio ha fallito"
 * da "nessun risultato" (lista vuota / null), che la UI deve mostrare in modo diverso.
 */
export class PoiProviderError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string
  ) {
    super(`POI provider: ${status} ${detail}`);
    this.name = 'PoiProviderError';
  }
}

export interface PoiProvider {
  /**
   * Autocomplete/ricerca testuale di luoghi.
   * `near` sposta i risultati verso quell'area (senza, la fonte cerca nel mondo intero).
   * @throws PoiProviderError se la fonte risponde con un errore.
   */
  search(query: string, opts?: { near?: Location; limit?: number; signal?: AbortSignal }): Promise<PoiSuggestion[]>;
  /** Dettagli completi di un luogo (quando disponibili dalla fonte). */
  details(placeId: string): Promise<Poi | null>;
  /**
   * Geocoding inverso: dal punto toccato sulla mappa al luogo più vicino.
   * null = nessun luogo noto in quel punto.
   * @throws PoiProviderError se la fonte risponde con un errore.
   */
  reverseGeocode(location: Location): Promise<PoiSuggestion | null>;
}

// --- Prezzi ------------------------------------------------------------

/** Informazione di prezzo aggregata mostrata in UI. */
export type PriceInfo = {
  /** Fascia baseline (€ – €€€€), se nota dalla fonte. */
  level?: PriceLevel;
  /** Prezzo reale più recente e votato (crowdsourced), se presente. */
  crowdPrice?: Money;
  /** Giorni trascorsi dal report più recente (freschezza). undefined = nessun report. */
  freshnessDays?: number;
  /** Voto netto del report (upvotes - downvotes). */
  score?: number;
};

export interface PriceProvider {
  /** Combina la baseline (priceLevel) con i report crowdsourced. */
  getPriceInfo(input: { priceLevel?: PriceLevel; reports: PriceReport[] }): PriceInfo;
}

// --- Affollamento ------------------------------------------------------

export interface CrowdProvider {
  /** Stima l'affollamento per categoria, giorno della settimana (0=dom) e ora (0-23). */
  estimateCrowd(category: StopCategory, weekday: number, hour: number): CrowdEstimate;
  /** Curva oraria (24 valori 0..1) per una categoria e un giorno: utile per il grafico. */
  dayCurve(category: StopCategory, weekday: number): number[];
}

export type { CrowdLevel };
