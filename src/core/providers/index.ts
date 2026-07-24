/**
 * Factory dei provider di dati. La UI importa da qui, non le classi concrete.
 * Default: stack gratuito OpenStreetMap. In futuro si potrà scegliere Google via env.
 */
import { EstimatedCrowdProvider } from './crowd/EstimatedCrowdProvider';
import { OsmPoiProvider } from './poi/OsmPoiProvider';
import { HybridPriceProvider } from './price/HybridPriceProvider';
import type { CrowdProvider, PoiProvider, PriceProvider } from './contracts';

export * from './contracts';

let poiProvider: PoiProvider | null = null;
let crowdProvider: CrowdProvider | null = null;
let priceProvider: PriceProvider | null = null;

export function getPoiProvider(): PoiProvider {
  if (!poiProvider) poiProvider = new OsmPoiProvider();
  return poiProvider;
}

export function getCrowdProvider(): CrowdProvider {
  if (!crowdProvider) crowdProvider = new EstimatedCrowdProvider();
  return crowdProvider;
}

export function getPriceProvider(): PriceProvider {
  if (!priceProvider) priceProvider = new HybridPriceProvider();
  return priceProvider;
}
