/**
 * BudgetSummary — la testata del budget: totale del viaggio, quota a persona e
 * numero di partecipanti (lo "split" del §7). Il totale è il numero grande, perché
 * è la domanda vera ("quanto costa"); la quota a persona lo accompagna.
 */
import { Minus, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { Budget } from '@/core/budget/budget';
import { formatMoney } from '@/core/utils/format';
import { Badge, Button, Card, Text } from '@/ui/components';
import { spacing, useTheme } from '@/ui/theme';

type Props = {
  budget: Budget;
  onChangePartySize: (partySize: number) => void;
};

export function BudgetSummary({ budget, onChangePartySize }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const people = t('budget.people', { count: budget.partySize });

  return (
    <Card padding="lg" style={styles.card}>
      <Text variant="overline" color="textTertiary">
        {t('budget.totalFor', { people })}
      </Text>
      <Text variant="display" tabular>
        {formatMoney(budget.total, budget.currency)}
      </Text>
      <Text variant="callout" color="textSecondary" tabular>
        {`${formatMoney(budget.perPerson, budget.currency)} ${t('common.perPerson')}`}
      </Text>

      {/* Partecipanti: cambia lo split, quindi il totale. */}
      <View style={styles.stepper}>
        <Button
          label=""
          variant="outline"
          size="sm"
          accessibilityLabel={`${t('budget.split')} −`}
          disabled={budget.partySize <= 1}
          leftIcon={<Minus color={colors.primary} size={18} />}
          onPress={() => onChangePartySize(Math.max(1, budget.partySize - 1))}
        />
        <Text variant="subhead" tabular style={styles.people}>
          {people}
        </Text>
        <Button
          label=""
          variant="outline"
          size="sm"
          accessibilityLabel={`${t('budget.split')} +`}
          leftIcon={<Plus color={colors.primary} size={18} />}
          onPress={() => onChangePartySize(budget.partySize + 1)}
        />
      </View>

      {/* Onestà del dato: cosa manca e cosa arriva dalla community. */}
      <View style={styles.badges}>
        {budget.missingCount > 0 ? (
          <Badge tone="warning" dot label={t('budget.missing', { count: budget.missingCount })} />
        ) : null}
        {budget.crowdSourcedCount > 0 ? (
          <Badge tone="primary" label={t('budget.fromCrowd')} />
        ) : null}
        {budget.foreignCurrencyCount > 0 ? (
          <Badge
            tone="danger"
            dot
            label={t('budget.foreign', { count: budget.foreignCurrencyCount })}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  people: { minWidth: 96, textAlign: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
});
