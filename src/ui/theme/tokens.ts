/**
 * TOKENS non-cromatici: spaziatura, raggi, tipografia, ombre.
 * Scala di spaziatura a base 4 (coerente con Tailwind). I raggi seguono uno stile
 * netto ma moderno da segnaletica. La tipografia usa il font di sistema (SF Pro / Roboto)
 * per UI/testo, e "Archivo" (grottesco geometrico da segnaletica) solo nei momenti display.
 */
import { Platform, type TextStyle } from 'react-native';

/** Spaziatura a base 4px. */
export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
  '6xl': 72,
} as const;

/** Raggi di bordo. `pill` per chip/badge, `full` per elementi circolari (marker). */
export const radius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 28,
  pill: 999,
  full: 9999,
} as const;

/**
 * Famiglie font. Il display usa Archivo (caricato all'avvio via expo-font);
 * finché non è pronto, il fallback è il font di sistema.
 */
export const fontFamily = {
  display: {
    semibold: 'Archivo_600SemiBold',
    bold: 'Archivo_700Bold',
    extrabold: 'Archivo_800ExtraBold',
  },
  // `System` risolve a San Francisco su iOS e Roboto su Android.
  system: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) as string,
} as const;

/**
 * Ruoli tipografici (ispirati alle text style di HIG e alla type scale di Material).
 * Nomi di ruolo, non misure sparse per schermata: si usano tramite il componente <Text variant>.
 */
export const typography = {
  /** Hero: nome itinerario in copertina. Display. */
  display: {
    fontFamily: fontFamily.display.extrabold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  /** Titolo grande di schermata. Display. */
  title1: {
    fontFamily: fontFamily.display.bold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  /** Titolo di sezione. Display. */
  title2: {
    fontFamily: fontFamily.display.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  /** Titolo di card / riga. Display semibold. */
  title3: {
    fontFamily: fontFamily.display.semibold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.1,
  },
  /** Enfasi in linea col testo. Sistema. */
  headline: { fontFamily: fontFamily.system, fontSize: 17, lineHeight: 22, fontWeight: '600' },
  /** Corpo di lettura. Sistema. */
  body: { fontFamily: fontFamily.system, fontSize: 17, lineHeight: 24, fontWeight: '400' },
  /** Corpo compatto. Sistema. */
  callout: { fontFamily: fontFamily.system, fontSize: 16, lineHeight: 22, fontWeight: '400' },
  /** Sottotitolo / etichetta di riga. Sistema medium. */
  subhead: { fontFamily: fontFamily.system, fontSize: 15, lineHeight: 20, fontWeight: '500' },
  /** Nota secondaria. Sistema. */
  footnote: { fontFamily: fontFamily.system, fontSize: 13, lineHeight: 18, fontWeight: '400' },
  /** Didascalia. Sistema medium. */
  caption: { fontFamily: fontFamily.system, fontSize: 12, lineHeight: 16, fontWeight: '500' },
  /** Micro-label da segnaletica: maiuscoletto tracciato. Da usare con parsimonia. */
  overline: {
    fontFamily: fontFamily.system,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

/**
 * Cifre tabellari: da applicare a orari e importi perché restino allineati in colonna.
 */
export const tabularNums: TextStyle = { fontVariant: ['tabular-nums'] };

/**
 * Ombre con offset + blur (mai aloni a offset zero). Su Android `elevation` guida
 * l'elevazione tonale di Material.
 */
export const elevation = {
  none: {},
  sm: Platform.select({
    ios: { shadowColor: '#0B0C10', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
    android: { elevation: 2 },
    default: {},
  }),
  md: Platform.select({
    ios: { shadowColor: '#0B0C10', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
    android: { elevation: 6 },
    default: {},
  }),
  lg: Platform.select({
    ios: { shadowColor: '#0B0C10', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.14, shadowRadius: 24 },
    android: { elevation: 12 },
    default: {},
  }),
} as const;

/** Durate di animazione (ms) coerenti col sistema. */
export const duration = { fast: 150, base: 240, slow: 360 } as const;

/** Tap target minimo cross-platform (44pt iOS / 48dp Android → usiamo 48). */
export const minTapTarget = 48;
