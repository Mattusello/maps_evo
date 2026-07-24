/**
 * EstimatedCrowdProvider — modello di affollamento STIMATO per l'MVP (§5).
 *
 * I "Popular Times" di Google non sono disponibili via API ufficiale, quindi stimiamo
 * l'affollamento con curve orarie tipiche per categoria, modulate dal giorno della settimana.
 * È un'euristica: la UI mostra sempre il dato come "stimato" (confidence < 1).
 * Isolato dietro CrowdProvider: in futuro si potrà collegare un servizio reale (es. BestTime)
 * senza toccare la UI.
 */
import type { CrowdEstimate, StopCategory } from '../../models';
import type { CrowdProvider } from '../contracts';

/** Curve orarie base (24 valori 0..1): affollamento relativo tipico nell'arco della giornata. */
const CURVES: Record<StopCategory, number[]> = {
  // Musei/cultura: chiusi presto, picco tarda mattina e metà pomeriggio.
  cultura: c([0,0,0,0,0,0,0,0,.1,.4,.7,.9,.8,.6,.7,.8,.7,.5,.3,.1,0,0,0,0]),
  // Ristoranti: doppio picco pranzo/cena.
  cibo: c([0,0,0,0,0,0,0,.1,.2,.2,.3,.6,.95,.8,.4,.3,.3,.4,.7,.95,.9,.6,.3,.1]),
  // Natura/parchi: gobba diurna con coda al tramonto.
  natura: c([0,0,0,0,0,0,.1,.2,.4,.6,.7,.75,.7,.7,.75,.8,.75,.6,.4,.2,.1,0,0,0]),
  // Panorami: picco pomeridiano + tramonto.
  panorama: c([0,0,0,0,0,0,.1,.2,.3,.4,.5,.6,.6,.6,.65,.75,.85,.9,.7,.4,.2,.1,0,0]),
  // Shopping: pomeriggio pieno.
  shopping: c([0,0,0,0,0,0,0,0,.1,.3,.5,.6,.6,.55,.6,.75,.85,.8,.6,.4,.2,.1,0,0]),
  // Vita notturna: quasi nulla di giorno, picco tardo.
  notte: c([.5,.3,.1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,.1,.3,.5,.75,.9,.95,.8]),
  // Alloggi: poco significativo, lieve punta serale (check-in).
  alloggio: c([.2,.1,.1,.1,.1,.1,.2,.3,.4,.3,.2,.2,.2,.2,.2,.3,.4,.6,.7,.6,.5,.4,.3,.2]),
  // Trasporti: ore di punta mattina/sera.
  trasporto: c([0,0,0,0,.1,.3,.6,.9,.95,.6,.4,.4,.4,.4,.4,.5,.7,.9,.85,.5,.3,.2,.1,0]),
  // Generico: gobba diurna.
  altro: c([0,0,0,0,0,0,.1,.2,.4,.5,.6,.6,.6,.55,.55,.6,.6,.5,.4,.3,.2,.1,0,0]),
};

/** Moltiplicatore per giorno settimana (0=dom … 6=sab). */
const WEEKDAY_MULT: Record<StopCategory, number[]> = {
  //          dom  lun  mar  mer  gio  ven  sab
  cultura:   [1.15, .8, .85, .85, .9, 1.0, 1.2],
  cibo:      [1.1, .85, .85, .9, .95, 1.15, 1.2],
  natura:    [1.25, .7, .75, .75, .8, .95, 1.25],
  panorama:  [1.2, .75, .8, .8, .85, 1.0, 1.25],
  shopping:  [1.05, .85, .85, .9, .95, 1.1, 1.3],
  notte:     [.7, .5, .55, .65, .9, 1.3, 1.4],
  alloggio:  [1.0, 1.0, 1.0, 1.0, 1.05, 1.15, 1.15],
  trasporto: [.7, 1.15, 1.15, 1.15, 1.15, 1.2, .8],
  altro:     [1.05, .9, .9, .95, 1.0, 1.05, 1.15],
};

/** Clamp e normalizzazione di un array a valori 0..1. */
function c(arr: number[]): number[] {
  return arr.map((v) => Math.max(0, Math.min(1, v)));
}

export class EstimatedCrowdProvider implements CrowdProvider {
  estimateCrowd(category: StopCategory, weekday: number, hour: number): CrowdEstimate {
    const wd = ((weekday % 7) + 7) % 7;
    const h = Math.max(0, Math.min(23, Math.round(hour)));
    const base = CURVES[category][h];
    const mult = WEEKDAY_MULT[category][wd];
    const intensity = Math.max(0, Math.min(1, base * mult));

    const level = intensity < 0.34 ? 'basso' : intensity < 0.67 ? 'medio' : 'alto';
    // Confidence più alta quando la curva è marcata (picchi/valli), più bassa nelle zone piatte.
    const confidence = 0.45 + Math.abs(intensity - 0.5) * 0.5;

    return { level, intensity, confidence: Math.min(0.9, confidence), source: 'estimated' };
  }

  dayCurve(category: StopCategory, weekday: number): number[] {
    const wd = ((weekday % 7) + 7) % 7;
    const mult = WEEKDAY_MULT[category][wd];
    return CURVES[category].map((v) => Math.max(0, Math.min(1, v * mult)));
  }
}
