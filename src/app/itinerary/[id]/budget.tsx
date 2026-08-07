/**
 * Schermata Budget (Fase 3): totale del viaggio, quota a persona, dettaglio per giorno
 * e per tappa. I costi si inseriscono **a persona**; il prezzo crowdsourced della Fase 2
 * è proposto come scorciatoia.
 */
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Map, PiggyBank } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { computeBudget } from '@/core/budget/budget';
import type { ItineraryWithDetails, Money, Stop } from '@/core/models';
import { getPriceProvider } from '@/core/providers';
import { getItineraryRepository, getPriceReportRepository } from '@/core/repositories';
import { formatMoney } from '@/core/utils/format';
import { BudgetSummary } from '@/features/budget/BudgetSummary';
import { CostSheet } from '@/features/budget/CostSheet';
import { useCategoryColor } from '@/features/stops/category';
import { Badge, Card, EmptyState, Screen, Skeleton, Text } from '@/ui/components';
import { spacing, useTheme } from '@/ui/theme';

export default function ItineraryBudgetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  // Colore-linea della categoria nel tema attivo (leggibile in chiaro e in scuro).
  const categoryColor = useCategoryColor();
  const router = useRouter();
  const { colors } = useTheme();
  const repo = useMemo(() => getItineraryRepository(), []);
  const priceRepo = useMemo(() => getPriceReportRepository(), []);

  const [detail, setDetail] = useState<ItineraryWithDetails | null>(null);
  const [crowdPrices, setCrowdPrices] = useState<Record<string, Money | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const data = await repo.get(id);
    setDetail(data);

    // Prezzi segnalati dalla community: entrano nei totali come ripiego dichiarato.
    if (data) {
      const provider = getPriceProvider();
      const entries = await Promise.all(
        data.days
          .flatMap((d) => d.stops)
          .map(async (stop) => {
            const reports = await priceRepo.list({ stopId: stop.id });
            return [stop.id, provider.getPriceInfo({ reports }).crowdPrice] as const;
          })
      );
      setCrowdPrices(Object.fromEntries(entries));
    }
    setLoading(false);
  }, [id, repo, priceRepo]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const budget = useMemo(
    () => (detail ? computeBudget(detail, { crowdPrices }) : null),
    [detail, crowdPrices]
  );

  const stopsById = useMemo(() => {
    const map: Record<string, Stop> = {};
    for (const day of detail?.days ?? []) for (const stop of day.stops) map[stop.id] = stop;
    return map;
  }, [detail]);

  const changePartySize = useCallback(
    async (partySize: number) => {
      if (!id) return;
      await repo.update(id, { partySize });
      await load();
    },
    [id, repo, load]
  );

  const saveCost = useCallback(
    async (stopId: string, cost: Money | undefined) => {
      await repo.updateStop(stopId, { cost });
      setSelectedStopId(null);
      await load();
    },
    [repo, load]
  );

  const hasStops = (detail?.days ?? []).some((d) => d.stops.length > 0);

  return (
    <Screen edges={['top']}>
      <View style={styles.topbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => router.back()}
          hitSlop={10}
        >
          <ArrowLeft color={colors.text} size={24} />
        </Pressable>
        <Text variant="title3" numberOfLines={1} style={styles.topbarTitle}>
          {t('budget.title')}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <Skeleton height={140} />
          <Skeleton height={90} />
        </View>
      ) : !detail || !budget ? (
        <EmptyState
          icon={<PiggyBank color={colors.primary} size={36} />}
          title={t('errors.notFound.title')}
          body={t('errors.notFound.body')}
          actionLabel={t('common.back')}
          onAction={() => router.back()}
        />
      ) : !hasStops ? (
        <EmptyState
          icon={<Map color={colors.primary} size={36} />}
          title={t('budget.empty.title')}
          body={t('budget.empty.body')}
          actionLabel={t('budget.empty.cta')}
          onAction={() => router.push(`/itinerary/${id}/map`)}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <BudgetSummary budget={budget} onChangePartySize={changePartySize} />

          <Text variant="footnote" color="textTertiary">
            {t('budget.hint')}
          </Text>

          {budget.days.map((day, index) => (
            <View key={day.dayId} style={styles.day}>
              <View style={styles.dayHead}>
                <Text variant="overline" color="textTertiary">
                  {day.label ?? t('itineraries.day', { index: index + 1 })}
                </Text>
                <Text variant="subhead" tabular>
                  {formatMoney(day.perPerson, budget.currency)}
                </Text>
              </View>

              {day.items.length === 0 ? (
                <Text variant="footnote" color="textTertiary">
                  {t('itineraries.dayEmpty')}
                </Text>
              ) : (
                <Card padding="none">
                  {day.items.map((item, i) => {
                    const stop = stopsById[item.stopId];
                    return (
                      <Pressable
                        key={item.stopId}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.title}, ${
                          item.amount === null
                            ? t('budget.noCost')
                            : formatMoney(item.amount, budget.currency)
                        }`}
                        onPress={() => setSelectedStopId(item.stopId)}
                        style={({ pressed }) => [
                          styles.row,
                          i > 0 && {
                            borderTopWidth: StyleSheet.hairlineWidth,
                            borderTopColor: colors.border,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        {stop ? (
                          <View
                            style={[styles.dot, { backgroundColor: categoryColor(stop.category) }]}
                          />
                        ) : null}
                        <Text variant="body" numberOfLines={1} style={styles.rowTitle}>
                          {item.title}
                        </Text>
                        {item.source === 'crowd' ? (
                          <Badge tone="primary" label={t('budget.fromCrowd')} />
                        ) : null}
                        {item.foreignCurrency ? (
                          <Badge tone="danger" dot label={stop?.cost?.currency ?? ''} />
                        ) : null}
                        <Text
                          variant={item.amount === null ? 'footnote' : 'headline'}
                          color={item.amount === null ? 'primary' : 'text'}
                          tabular
                        >
                          {item.amount === null
                            ? t('budget.addCost')
                            : formatMoney(item.amount, budget.currency)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </Card>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <CostSheet
        stop={selectedStopId ? (stopsById[selectedStopId] ?? null) : null}
        currency={detail?.currency ?? 'EUR'}
        crowdPrice={selectedStopId ? crowdPrices[selectedStopId] : undefined}
        onDismiss={() => setSelectedStopId(null)}
        onSave={saveCost}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  topbarTitle: { flex: 1 },
  loading: { padding: spacing.lg, gap: spacing.md },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing['5xl'] },
  day: { gap: spacing.sm },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  pressed: { opacity: 0.9 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowTitle: { flex: 1 },
});
