/** Timestamp ISO 8601 corrente (usato per createdAt/updatedAt). */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Minuti in un giorno: comodo per i clamp della timeline. */
export const MINUTES_IN_DAY = 24 * 60;

/**
 * "09:30" → 570 (minuti da mezzanotte). Restituisce null se il formato non è valido:
 * gli orari arrivano da input utente, meglio un null esplicito che un NaN silenzioso.
 */
export function parseClock(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** 570 → "09:30". Oltre la mezzanotte l'orario prosegue sul giorno dopo (25:00 → "01:00"). */
export function formatClock(minutes: number): string {
  const wrapped = ((Math.round(minutes) % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Durata in forma leggibile: 45 → "45 min", 90 → "1 h 30 min", 120 → "2 h". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Ora del giorno (0-23) di un orario espresso in minuti da mezzanotte. */
export function hourOf(minutes: number): number {
  return Math.floor((((minutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY) / 60);
}

/**
 * Giorno della settimana (0=domenica) di una data ISO "YYYY-MM-DD".
 * Se la data manca o non è valida usa il fallback (di norma "oggi"), perché un
 * itinerario può non avere date fisse ma l'affollamento va comunque stimato.
 */
export function weekdayOf(isoDate: string | undefined, fallback: Date = new Date()): number {
  if (isoDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
    if (match) {
      const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      if (!Number.isNaN(d.getTime())) return d.getDay();
    }
  }
  return fallback.getDay();
}
