/**
 * Screen: contenitore di schermata con safe-area e sfondo a tema.
 * `edges` controlla quali lati rispettano l'inset (default: solo top/bottom;
 * per schermate con mappa a tutto schermo si passa []).
 */
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';

export type ScreenProps = {
  children: ReactNode;
  edges?: readonly Edge[];
};

export function Screen({ children, edges = ['top', 'bottom'] }: ScreenProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.background }]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
