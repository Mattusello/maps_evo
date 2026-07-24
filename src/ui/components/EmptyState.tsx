/**
 * EmptyState: stato vuoto illustrato con icona in un "medaglione" da segnaletica,
 * titolo, testo e azione facoltativa. Usato quando una lista non ha contenuti.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/tokens';
import { Button } from './Button';
import { Text } from './Text';

export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.root}>
      <View style={[styles.medallion, { backgroundColor: colors.primaryContainer }]}>{icon}</View>
      <Text variant="title2" style={styles.center}>
        {title}
      </Text>
      {body ? (
        <Text variant="callout" color="textSecondary" style={styles.center}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing.md },
  medallion: {
    width: 88,
    height: 88,
    borderRadius: radius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  center: { textAlign: 'center' },
  action: { marginTop: spacing.md, alignSelf: 'stretch' },
});
