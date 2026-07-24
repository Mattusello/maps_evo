/**
 * Logica di stato apertura in tempo reale a partire dagli orari di un POI.
 * Ritorna dati "grezzi" (non stringhe): la UI compone i testi via i18n.
 */
import type { OpeningHours } from '@/core/models';

export type OpenStatus =
  | { kind: 'always' }
  | { kind: 'unknown' }
  | { kind: 'open'; closesAt: string; closesInMinutes: number }
  | { kind: 'closed'; opensAt?: string };

/** Minuti dalla mezzanotte → "HH:MM". */
export function formatMinutes(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function getOpenStatus(hours: OpeningHours | undefined, now: Date): OpenStatus {
  if (!hours) return { kind: 'unknown' };
  if (hours.alwaysOpen) return { kind: 'always' };

  const weekday = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const periods = hours.byWeekday[String(weekday)] ?? [];

  // Aperto ora?
  for (const p of periods) {
    if (minutes >= p.open && minutes < p.close) {
      return { kind: 'open', closesAt: formatMinutes(p.close), closesInMinutes: p.close - minutes };
    }
  }

  // Chiuso: cerca la prossima apertura di oggi.
  const upcoming = periods
    .filter((p) => p.open > minutes)
    .sort((a, b) => a.open - b.open)[0];
  if (upcoming) return { kind: 'closed', opensAt: formatMinutes(upcoming.open) };

  return { kind: 'closed' };
}

/** Soglia (minuti) sotto la quale mostrare l'avviso "chiude tra N min". */
export const CLOSING_SOON_THRESHOLD = 60;
