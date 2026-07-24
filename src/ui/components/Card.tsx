/**
 * Card: superficie contenitore. Non annidare card dentro card.
 * `interactive` la rende premibile con feedback discreto.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { elevation, radius, spacing } from '../theme/tokens';

export type CardProps = ViewProps & {
  children: ReactNode;
  padding?: keyof typeof spacing;
  raised?: boolean;
  interactive?: boolean;
  onPress?: () => void;
};

export function Card({
  children,
  padding = 'lg',
  raised = false,
  interactive = false,
  onPress,
  style,
  ...rest
}: CardProps) {
  const { colors } = useTheme();
  const base = [
    styles.base,
    { backgroundColor: colors.surface, borderColor: colors.border, padding: spacing[padding] },
    raised && elevation.md,
    style,
  ];

  if (interactive || onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [...base, pressed && styles.pressed]}
        {...(rest as object)}>
        {children}
      </Pressable>
    );
  }

  return (
    <View style={base} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
});
