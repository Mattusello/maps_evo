/**
 * Utility per i test di componente: monta un albero con i provider che ogni schermata dà per
 * scontati (tema, safe-area) e con i18n già inizializzato, così le asserzioni si scrivono
 * sulle **stringhe reali** dell'app invece che su chiavi tecniche.
 *
 * I provider di dominio (itinerari, auth) restano fuori: nei test si mockano, così ogni
 * schermata si prova senza toccare la persistenza.
 */
import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/i18n';
import { ThemeProvider, type ThemePreference } from '@/ui/theme';

/** Inset finti: senza questi `SafeAreaProvider` resta in attesa della misura e non rende. */
const FRAME = { x: 0, y: 0, width: 390, height: 844 };
const INSETS = { top: 47, left: 0, right: 0, bottom: 34 };

/**
 * ⚠️ In @testing-library/react-native 14 (React 19, rendering concorrente) **sia `render`
 * sia `fireEvent` sono asincroni**: vanno sempre attesi con `await`, altrimenti i cambi di
 * stato non risultano applicati e i test falliscono senza spiegare perché. Le query si
 * leggono da `screen` dopo l'attesa.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions & { theme?: ThemePreference } = {}
) {
  const { theme = 'light', ...rest } = options;
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <SafeAreaProvider initialMetrics={{ frame: FRAME, insets: INSETS }}>
      <ThemeProvider preference={theme}>{children}</ThemeProvider>
    </SafeAreaProvider>
  );
  return render(ui, { wrapper: Wrapper, ...rest });
}
