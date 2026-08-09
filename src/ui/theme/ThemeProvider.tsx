/**
 * ThemeProvider: calcola lo schema attivo (light/dark) incrociando lo schema di sistema
 * con la preferenza utente ('light' | 'dark' | 'system') ed espone la palette semantica
 * attiva ai consumatori JS. È l'unica fonte di colore dell'app: NativeWind è stato rimosso
 * (vedi babel.config.js) e nessun componente usa `className`.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { palettes, type ColorScheme, type SemanticColors } from './palette';
import { elevation, radius, spacing, typography } from './tokens';

export type ThemePreference = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  scheme: ColorScheme;
  colors: SemanticColors;
  spacing: typeof spacing;
  radius: typeof radius;
  elevation: typeof elevation;
  typography: typeof typography;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  preference = 'system',
  children,
}: {
  preference?: ThemePreference;
  children: ReactNode;
}) {
  // useColorScheme può restituire 'light' | 'dark' | 'unspecified' | null: tutto ciò che
  // non è 'dark' lo trattiamo come 'light'.
  const systemScheme: ColorScheme = useRNColorScheme() === 'dark' ? 'dark' : 'light';
  const scheme: ColorScheme = preference === 'system' ? systemScheme : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({ scheme, colors: palettes[scheme], spacing, radius, elevation, typography }),
    [scheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Accesso al tema attivo (palette + token) dai componenti. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme deve essere usato dentro <ThemeProvider>.');
  return ctx;
}

/** Scorciatoia quando servono solo i colori. */
export function useThemeColors(): SemanticColors {
  return useTheme().colors;
}
