/**
 * Chip: filtro/selezione a pillola (categorie, giorni). Stato selezionato evidente.
 * `leadingColor` mostra il "colore di linea" della categoria (stile legenda segnaletica).
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { minTapTarget, radius, spacing } from '../theme/tokens';
import { Text } from './Text';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  leadingColor?: string;
  icon?: ReactNode;
};

export function Chip({ label, selected = false, onPress, leadingColor, icon }: ChipProps) {
  const { colors } = useTheme();
  const bg = selected ? colors.primary : colors.surface;
  const fg = selected ? colors.onPrimary : colors.text;
  const borderColor = selected ? colors.primary : colors.border;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderColor },
        pressed && styles.pressed,
      ]}>
      {leadingColor && !selected && (
        <View style={[styles.dot, { backgroundColor: leadingColor }]} />
      )}
      {icon}
      <Text variant="subhead" colorValue={fg} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 36,
    minWidth: minTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.85 },
  dot: { width: 8, height: 8, borderRadius: radius.full },
});
