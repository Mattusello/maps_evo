/**
 * Button: azione con varianti e stati (default, pressed, disabled, loading).
 * Tap target ≥ 48 e feedback di pressione discreto (scala). Icone opzionali ai lati.
 */
import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { minTapTarget, radius, spacing } from '../theme/tokens';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'tonal' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

const SIZE = {
  sm: { minHeight: 40, paddingH: spacing.md, variant: 'subhead' as const },
  md: { minHeight: minTapTarget, paddingH: spacing.lg, variant: 'headline' as const },
  lg: { minHeight: 56, paddingH: spacing.xl, variant: 'headline' as const },
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const { bg, fg, borderColor } = useMemo(() => {
    switch (variant) {
      case 'primary':
        return { bg: colors.primary, fg: colors.onPrimary, borderColor: 'transparent' };
      case 'danger':
        return { bg: colors.danger, fg: '#FFFFFF', borderColor: 'transparent' };
      case 'tonal':
        return { bg: colors.primaryContainer, fg: colors.onPrimaryContainer, borderColor: 'transparent' };
      case 'outline':
        return { bg: 'transparent', fg: colors.primary, borderColor: colors.border };
      case 'ghost':
      default:
        return { bg: 'transparent', fg: colors.primary, borderColor: 'transparent' };
    }
  }, [variant, colors]);

  const sz = SIZE[size];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: sz.minHeight,
          paddingHorizontal: sz.paddingH,
          backgroundColor: bg,
          borderColor,
          borderWidth: variant === 'outline' ? StyleSheet.hairlineWidth * 2 : 0,
        },
        fullWidth && styles.fullWidth,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.content}>
          {leftIcon}
          <Text variant={sz.variant} colorValue={fg} numberOfLines={1}>
            {label}
          </Text>
          {rightIcon}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fullWidth: { alignSelf: 'stretch' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.4 },
});
