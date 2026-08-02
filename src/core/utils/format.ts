import type { Currency, PriceLevel } from '../models';

/** Formatta un importo con la valuta (locale it). */
export function formatMoney(amount: number, currency: Currency): string {
  try {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * Distanza leggibile: sotto il chilometro in metri arrotondati a 50,
 * sopra in km con un decimale (separatore decimale italiano).
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

/** Fascia di prezzo baseline come simboli: 1 → "€", 4 → "€€€€". 0 → gratis. */
export function priceLevelSymbol(level: PriceLevel): string {
  if (level <= 0) return 'Gratis';
  return '€'.repeat(Math.min(4, level));
}
