/**
 * PALETTE — fonte di verità dei colori di MyMappa.
 *
 * Mondo visivo: "Segnaletica / Wayfinding". Fondo neutro e spazioso + un accento
 * "route" indaco elettrico che porta linee-percorso, marker e azioni primarie.
 * L'accento è TENUTO DISTINTO dalla scala semantica di stato (success/warning/danger),
 * così il brand non collide mai col significato (verde = poco affollato, non = brand).
 *
 * ⚠️ SINCRONIZZAZIONE: i valori qui sono consumati dal codice JS (mappa, bottom sheet,
 * Reanimated). Gli stessi valori sono rispecchiati come variabili CSS in `src/global.css`
 * per l'uso tramite `className` di NativeWind. Se cambi un colore, aggiorna entrambi.
 */

export type SemanticColors = {
  /** Sfondo di base della schermata. */
  background: string;
  /** Superficie elevata (card, sheet). */
  surface: string;
  /** Superficie attenuata (riempimenti, campi, stati hover). */
  surfaceMuted: string;
  /** Separatori e bordi hairline. */
  border: string;

  /** Testo primario. */
  text: string;
  /** Testo secondario / didascalie. */
  textSecondary: string;
  /** Testo terziario / placeholder. */
  textTertiary: string;

  /** Accento di brand ("route" indaco): azioni primarie, linea-percorso, marker attivi. */
  primary: string;
  /** Testo/icona sopra `primary`. */
  onPrimary: string;
  /** Riempimento tenue del brand (chip attivi, badge). */
  primaryContainer: string;
  /** Testo/icona sopra `primaryContainer`. */
  onPrimaryContainer: string;

  /** Stato positivo: aperto, affollamento basso. */
  success: string;
  successContainer: string;
  /** Stato di attenzione: chiude a breve, affollamento medio. */
  warning: string;
  warningContainer: string;
  /** Stato critico: chiuso, affollamento alto. */
  danger: string;
  dangerContainer: string;
};

export const lightColors: SemanticColors = {
  background: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceMuted: '#EDEFF3',
  border: '#E1E4EA',

  text: '#14161B',
  textSecondary: '#565D6B',
  textTertiary: '#838A98',

  primary: '#3A31E0',
  onPrimary: '#FFFFFF',
  primaryContainer: '#E7E5FF',
  onPrimaryContainer: '#241C9E',

  success: '#0B8A4B',
  successContainer: '#D6F2E1',
  warning: '#A65E00',
  warningContainer: '#FBE9C8',
  danger: '#C0341C',
  dangerContainer: '#FADFD8',
};

export const darkColors: SemanticColors = {
  background: '#0B0C10',
  surface: '#15171E',
  surfaceMuted: '#1F222C',
  border: '#2B2F3A',

  text: '#F3F5F8',
  textSecondary: '#A6ADBB',
  textTertiary: '#717886',

  primary: '#8F87FF',
  onPrimary: '#0B0C10',
  primaryContainer: '#251F63',
  onPrimaryContainer: '#D8D4FF',

  success: '#45CE86',
  successContainer: '#10331F',
  warning: '#EDB24C',
  warningContainer: '#382808',
  danger: '#FF7B60',
  dangerContainer: '#3A160E',
};

/**
 * Colori delle categorie di tappa = "colori di linea" del sistema di segnaletica.
 * Usati per i marker sulla mappa e i chip di categoria. Un set unico per entrambi i temi
 * (già sufficientemente vividi per fondo chiaro e scuro).
 */
export const categoryColors = {
  cultura: '#6C4BF0',
  cibo: '#E8590C',
  natura: '#0E8A4F',
  panorama: '#1098AD',
  shopping: '#D6336C',
  notte: '#7048E8',
  alloggio: '#B4790B',
  trasporto: '#5C6470',
} as const;

export type CategoryKey = keyof typeof categoryColors;

export type ColorScheme = 'light' | 'dark';

export const palettes: Record<ColorScheme, SemanticColors> = {
  light: lightColors,
  dark: darkColors,
};
