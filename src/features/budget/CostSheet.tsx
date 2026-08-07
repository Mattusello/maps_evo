/**
 * CostSheet — foglio compatto per il costo di una tappa (a persona).
 * Se la community ha segnalato un prezzo per quella tappa, lo propone con un tocco:
 * è il punto in cui il dato crowdsourced della Fase 2 diventa budget.
 */
import { Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { Currency, Money, Stop } from '@/core/models';
import { formatMoney } from '@/core/utils/format';
import { categoryLabel, useCategoryColor } from '@/features/stops/category';
import { Button, Sheet, Text, TextField } from '@/ui/components';
import { spacing, useTheme } from '@/ui/theme';

type Props = {
  stop: Stop | null;
  currency: Currency;
  /** Prezzo segnalato dalla community per questa tappa, se presente. */
  crowdPrice?: Money;
  onDismiss: () => void;
  onSave: (stopId: string, cost: Money | undefined) => void;
};

/** "12,50" → 12.5; null se non è un importo valido. */
function parseAmount(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function CostSheet({ stop, currency, crowdPrice, onDismiss, onSave }: Props) {
  const { t } = useTranslation();
  // Colore-linea della categoria nel tema attivo (leggibile in chiaro e in scuro).
  const categoryColor = useCategoryColor();
  const { colors } = useTheme();

  const [amount, setAmount] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!stop) return;
    setAmount(stop.cost ? String(stop.cost.amount).replace('.', ',') : '');
    setTouched(false);
  }, [stop]);

  const parsed = parseAmount(amount);
  const invalid = touched && amount.trim() !== '' && parsed === null;

  return (
    <Sheet open={stop !== null} onDismiss={onDismiss} snapPoints={['45%']}>
      {stop ? (
        <>
          <Text variant="overline" colorValue={categoryColor(stop.category)}>
            {categoryLabel(t, stop.category)}
          </Text>
          <Text variant="title2" numberOfLines={2}>
            {stop.title}
          </Text>

          <TextField
            label={`${t('timeline.cost')} (${currency})`}
            placeholder={t('timeline.costPlaceholder')}
            value={amount}
            onChangeText={(v) => {
              setAmount(v);
              setTouched(true);
            }}
            keyboardType="decimal-pad"
            autoFocus
            error={invalid ? t('timeline.costInvalid') : undefined}
          />

          {crowdPrice && crowdPrice.currency === currency ? (
            <Button
              label={`${t('budget.fromCrowd')} · ${formatMoney(crowdPrice.amount, crowdPrice.currency)}`}
              variant="tonal"
              size="sm"
              leftIcon={<Users color={colors.onPrimaryContainer} size={16} />}
              onPress={() => setAmount(String(crowdPrice.amount).replace('.', ','))}
            />
          ) : null}

          <Text variant="footnote" color="textTertiary">
            {t('budget.hint')}
          </Text>

          <View style={styles.actions}>
            <Button
              label={t('common.save')}
              fullWidth
              disabled={invalid}
              onPress={() =>
                onSave(stop.id, parsed === null ? undefined : { amount: parsed, currency })
              }
            />
            {stop.cost ? (
              <Button
                label={t('common.delete')}
                variant="ghost"
                onPress={() => onSave(stop.id, undefined)}
              />
            ) : null}
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.xs },
});
