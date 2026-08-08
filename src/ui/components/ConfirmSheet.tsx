/**
 * ConfirmSheet — conferma per un'azione che non si può annullare.
 *
 * Passa da `Sheet`, quindi funziona anche sul web (vedi docs/HANDOFF.md §7). L'azione
 * distruttiva non è mai quella di riposo: `Annulla` resta a sinistra e non ha peso visivo,
 * la conferma porta il colore di pericolo e dice cosa fa ("Elimina"), non "OK".
 */
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../theme/tokens';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { Text } from './Text';

export type ConfirmSheetProps = {
  open: boolean;
  title: string;
  /** Conseguenze dell'azione: cosa sparisce, cosa non è recuperabile. */
  body?: string;
  confirmLabel: string;
  /** Etichetta dell'uscita di sicurezza. Default: `common.cancel`. */
  cancelLabel?: string;
  /** Colora la conferma come azione di pericolo. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onDismiss={onCancel} snapPoints={['35%']}>
      <View style={styles.root}>
        <Text variant="title2">{title}</Text>
        {body ? (
          <Text variant="callout" color="textSecondary">
            {body}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Button label={cancelLabel ?? t('common.cancel')} variant="ghost" onPress={onCancel} />
          <Button
            label={confirmLabel}
            variant={destructive ? 'danger' : 'primary'}
            onPress={onConfirm}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
});
