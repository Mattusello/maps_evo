import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CalendarPlus, Map, PiggyBank, Clock } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { getItineraryRepository } from '@/core/repositories';
import type { ItineraryWithDetails } from '@/core/models';
import { Badge, Button, Card, Screen, Skeleton, Text } from '@/ui/components';
import { spacing, useTheme } from '@/ui/theme';

export default function ItineraryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const repo = useMemo(() => getItineraryRepository(), []);

  const [detail, setDetail] = useState<ItineraryWithDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setDetail(await repo.get(id));
    setLoading(false);
  }, [id, repo]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const addDay = async () => {
    if (!id) return;
    await repo.addDay(id);
    await load();
  };

  const stopCount = detail?.days.reduce((n, d) => n + d.stops.length, 0) ?? 0;

  return (
    <Screen edges={['top']}>
      <View style={styles.topbar}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft color={colors.text} size={24} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading && !detail ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={32} width="80%" />
            <Skeleton height={18} width="50%" />
          </View>
        ) : !detail ? (
          <Text variant="body" color="textSecondary">
            {t('common.retry')}
          </Text>
        ) : (
          <>
            <View style={styles.head}>
              <Text variant="display">{detail.title}</Text>
              {detail.description ? (
                <Text variant="callout" color="textSecondary">
                  {detail.description}
                </Text>
              ) : null}
              <View style={styles.badges}>
                <Badge tone="primary" dot label={t('itineraries.days', { count: detail.days.length })} />
                <Badge label={t('itineraries.stops', { count: stopCount })} />
                <Badge label={detail.currency} />
              </View>
            </View>

            {/* Azioni verso le viste dell'itinerario (Mappa/Timeline/Budget). */}
            <View style={styles.actions}>
              <ActionTile
                icon={<Map color={colors.primary} size={22} />}
                label={t('tabs.explore')}
                onPress={() => router.push(`/itinerary/${id}/map`)}
              />
              <ActionTile
                icon={<Clock color={colors.primary} size={22} />}
                label={t('timeline.title')}
                onPress={() => router.push(`/itinerary/${id}/timeline`)}
              />
              <ActionTile
                icon={<PiggyBank color={colors.primary} size={22} />}
                label={t('budget.title')}
                onPress={() => router.push(`/itinerary/${id}/budget`)}
              />
            </View>

            {/* Giorni */}
            <View style={{ gap: spacing.md }}>
              {detail.days.map((day, i) => (
                <Card key={day.id} padding="lg">
                  <Text variant="title3">
                    {day.label ?? t('itineraries.day', { index: i + 1 })}
                  </Text>
                  {day.stops.length === 0 ? (
                    <Text variant="footnote" color="textTertiary" style={{ marginTop: spacing.xs }}>
                      {t('itineraries.empty.body')}
                    </Text>
                  ) : (
                    day.stops.map((s) => (
                      <Text key={s.id} variant="body" style={{ marginTop: spacing.xs }}>
                        • {s.title}
                      </Text>
                    ))
                  )}
                </Card>
              ))}

              <Button
                label={t('common.add')}
                variant="tonal"
                fullWidth
                leftIcon={<CalendarPlus color={colors.onPrimaryContainer} size={18} />}
                onPress={addDay}
              />
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function ActionTile({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Card interactive onPress={onPress} padding="md" style={styles.tile}>
      <View style={styles.tileInner}>
        {icon}
        <Text variant="caption" numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  topbar: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing['4xl'] },
  head: { gap: spacing.sm },
  badges: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.md },
  tile: { flex: 1 },
  tileInner: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
});
