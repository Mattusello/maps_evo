/**
 * BUDGET (§6.6 + §7 "split").
 *
 * Convenzione del modello — **i costi di una tappa sono a persona**.
 * È la forma in cui li si conosce viaggiando (biglietto 12 €, pranzo 25 €) ed è coerente
 * con i prezzi crowdsourced (`PriceReport`), che sono anch'essi per persona.
 * Il totale di gruppo è quindi `costo a persona × partySize`: è lì che vive lo "split".
 *
 * Un costo in valuta diversa da quella dell'itinerario **non viene convertito** (non abbiamo
 * tassi di cambio e inventarli sarebbe disonesto): viene contato a parte e la UI lo segnala.
 *
 * Funzione pura: nessuna dipendenza da React o dallo storage.
 */
import type { Currency, ItineraryWithDetails, Money } from '../models';

/** Da dove arriva l'importo usato per una tappa. */
export type CostSource = 'planned' | 'crowd' | 'none';

export type StopCost = {
  stopId: string;
  title: string;
  /** Importo a persona nella valuta dell'itinerario; null se non disponibile. */
  amount: number | null;
  source: CostSource;
  /** true se il costo esiste ma è in un'altra valuta (quindi escluso dai totali). */
  foreignCurrency: boolean;
};

export type DayBudget = {
  dayId: string;
  label?: string;
  date?: string;
  items: StopCost[];
  /** Totale del giorno a persona. */
  perPerson: number;
  /** Totale del giorno per l'intero gruppo. */
  total: number;
  /** Tappe senza alcun costo noto. */
  missingCount: number;
};

export type Budget = {
  currency: Currency;
  partySize: number;
  days: DayBudget[];
  /** Totale itinerario a persona. */
  perPerson: number;
  /** Totale itinerario per l'intero gruppo. */
  total: number;
  /** Tappe senza costo (l'utente può completarle). */
  missingCount: number;
  /** Tappe con costo in valuta diversa, escluse dai totali. */
  foreignCurrencyCount: number;
  /** Quota del totale coperta da prezzi crowdsourced invece che indicati dall'utente. */
  crowdSourcedCount: number;
};

export type BudgetOptions = {
  /**
   * Prezzi crowdsourced per tappa (da `PriceProvider`), usati come ripiego quando
   * l'utente non ha indicato un costo. La UI deve mostrarli come stimati.
   */
  crowdPrices?: Record<string, Money | undefined>;
};

/** Arrotonda a 2 decimali evitando le code binarie (0.1 + 0.2). */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Calcola il budget completo di un itinerario. */
export function computeBudget(
  itinerary: ItineraryWithDetails,
  options: BudgetOptions = {}
): Budget {
  const currency = itinerary.currency;
  const partySize = Math.max(1, itinerary.partySize);
  const crowdPrices = options.crowdPrices ?? {};

  let foreignCurrencyCount = 0;
  let crowdSourcedCount = 0;

  const days: DayBudget[] = itinerary.days.map((day) => {
    const items: StopCost[] = day.stops.map((stop) => {
      const planned = stop.cost;
      const crowd = crowdPrices[stop.id];

      if (planned && planned.currency === currency) {
        return {
          stopId: stop.id,
          title: stop.title,
          amount: planned.amount,
          source: 'planned',
          foreignCurrency: false,
        };
      }
      if (planned && planned.currency !== currency) {
        foreignCurrencyCount += 1;
        return {
          stopId: stop.id,
          title: stop.title,
          amount: null,
          source: 'planned',
          foreignCurrency: true,
        };
      }
      if (crowd && crowd.currency === currency) {
        crowdSourcedCount += 1;
        return {
          stopId: stop.id,
          title: stop.title,
          amount: crowd.amount,
          source: 'crowd',
          foreignCurrency: false,
        };
      }
      return {
        stopId: stop.id,
        title: stop.title,
        amount: null,
        source: 'none',
        foreignCurrency: false,
      };
    });

    const perPerson = round2(items.reduce((sum, i) => sum + (i.amount ?? 0), 0));
    return {
      dayId: day.id,
      label: day.label,
      date: day.date,
      items,
      perPerson,
      total: round2(perPerson * partySize),
      missingCount: items.filter((i) => i.amount === null).length,
    };
  });

  const perPerson = round2(days.reduce((sum, d) => sum + d.perPerson, 0));

  return {
    currency,
    partySize,
    days,
    perPerson,
    total: round2(perPerson * partySize),
    missingCount: days.reduce((n, d) => n + d.missingCount, 0),
    foreignCurrencyCount,
    crowdSourcedCount,
  };
}
