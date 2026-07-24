/**
 * Fab: azione primaria flottante (una sola per schermata, come da Material).
 * Estesa con etichetta opzionale. Ombra con offset + blur.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { elevation, radius, spacing } from '../theme/tokens';
import { Text } from './Text';

export function Fab({
  icon,
  label,
  onPress,
  accessibilityLabel,
}: {
  icon: ReactNode;
  label?: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: colors.primary },
        elevation.lg,
        pressed && styles.pressed,
      ]}>
      {icon}
      {label ? (
        <Text variant="headline" colorValue={colors.onPrimary}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    minHeight: 56,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
});
