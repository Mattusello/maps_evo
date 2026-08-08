/**
 * ScreenHeader: la barra in cima alle schermate di secondo livello (Indietro + titolo +
 * azioni). Esiste perché la stessa barra era ricopiata a mano in ogni schermata e le
 * misure avevano finito per divergere: dove il Indietro stava in un box da 48 la barra
 * era alta 64, dove l'icona era nuda 40 — il pulsante saltava di 12px passando da una
 * schermata all'altra, e il tap target scendeva sotto il minimo.
 *
 * Qui la geometria è una sola: barra alta `spacing.sm + minTapTarget + spacing.sm`,
 * icona da 24 centrata in un tap target da 48 tirato indietro di `spacing.md` così che
 * l'icona resti otticamente allineata al contenuto sottostante.
 */
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { minTapTarget, spacing } from '../theme/tokens';
import { Text } from './Text';

export type ScreenHeaderProps = {
  /** Titolo della schermata. Assente sulle schermate che hanno il titolo nel contenuto. */
  title?: string;
  onBack?: () => void;
  /** Etichetta accessibile del pulsante Indietro (già tradotta). */
  backLabel: string;
  /** Azioni allineate a destra: usare `HeaderIconButton` per mantenere le stesse misure. */
  actions?: ReactNode;
};

export function ScreenHeader({ title, onBack, backLabel, actions }: ScreenHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.bar}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          onPress={onBack}
          hitSlop={10}
          style={[styles.iconBtn, styles.iconBtnEdge]}>
          <ArrowLeft color={colors.text} size={24} />
        </Pressable>
      ) : null}

      {title ? (
        <Text variant="title3" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
      ) : (
        <View style={styles.title} />
      )}

      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

/** Pulsante-icona delle azioni di testata: stesse misure del Indietro. */
export function HeaderIconButton({
  accessibilityLabel,
  onPress,
  children,
}: {
  accessibilityLabel: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={10}
      style={styles.iconBtn}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  title: { flex: 1 },
  // Tap target pieno (48) senza perdere l'allineamento ottico col contenuto sotto.
  iconBtn: {
    width: minTapTarget,
    height: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnEdge: { marginLeft: -spacing.md },
  actions: { flexDirection: 'row', gap: spacing.xs, marginRight: -spacing.md },
});
