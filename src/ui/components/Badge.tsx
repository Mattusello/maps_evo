/**
 * Badge: etichetta di stato compatta (es. "Aperto", "Chiude alle 18:00", "Affollamento medio").
 * Il tono mappa la scala semantica; `dot` mostra un pallino guida stile segnaletica.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import type { SemanticColors } from '../theme/palette';
import { radius, spacing } from '../theme/tokens';
import { Text } from './Text';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  dot?: boolean;
  icon?: ReactNode;
};

function toneColors(tone: BadgeTone, c: SemanticColors): { bg: string; fg: string } {
  switch (tone) {
    case 'primary':
      return { bg: c.primaryContainer, fg: c.onPrimaryContainer };
    case 'success':
      return { bg: c.successContainer, fg: c.success };
    case 'warning':
      return { bg: c.warningContainer, fg: c.warning };
    case 'danger':
      return { bg: c.dangerContainer, fg: c.danger };
    case 'neutral':
    default:
      return { bg: c.surfaceMuted, fg: c.textSecondary };
  }
}

export function Badge({ label, tone = 'neutral', dot = false, icon }: BadgeProps) {
  const { colors } = useTheme();
  const { bg, fg } = toneColors(tone, colors);
  return (
    <View style={[styles.base, { backgroundColor: bg }]}>
      {dot && <View style={[styles.dot, { backgroundColor: fg }]} />}
      {icon}
      <Text variant="caption" colorValue={fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  dot: { width: 7, height: 7, borderRadius: radius.full },
});
