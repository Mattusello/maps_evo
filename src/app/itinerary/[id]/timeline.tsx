/**
 * Schermata Timeline (Fase 3): le giornate dell'itinerario con orari pianificati,
 * spostamenti stimati, riordino per trascinamento e ottimizzazione del percorso.
 *
 * Le mutazioni passano tutte dal repository astratto (`@/core/repositories`), mai
 * direttamente dallo storage.
 */
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Clock, Map } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { ItineraryWithDetails, Stop } from '@/core/models';
import { getItineraryRepository } from '@/core/repositories';
import type { StopPatch } from '@/core/repositories/contracts';
import { computeDaySchedule } from '@/core/schedule/daySchedule';
import { optimizeRoute } from '@/core/tsp/optimizeRoute';
import { formatDistance } from '@/core/utils/format';
import { formatClock } from '@/core/utils/time';
import { DayTimeline } from '@/features/timeline/DayTimeline';
import { StopScheduleSheet } from '@/features/timeline/StopScheduleSheet';
import { Button, EmptyState, Screen, Skeleton, Text } from '@/ui/components';
import { spacing, useTheme } from '@/ui/theme';

export default function ItineraryTimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const repo = useMemo(() => getItineraryRepository(), []);

  const [detail, setDetail] = useState<ItineraryWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  /** Esito dell'ultima ottimizzazione, per giornata. */
  const [optimizeMessages, setOptimizeMessages] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!id) return;
    setDetail(await repo.get(id));
    setLoading(false);
  }, [id, repo]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // Giornata e posizione della tappa selezionata: servono al foglio di modifica.
  const selection = useMemo(() => {
    if (!detail || !selectedStopId) return null;
    for (const day of detail.days) {
      const index = day.stops.findIndex((s) => s.id === selectedStopId);
      if (index !== -1) {
        const schedule = computeDaySchedule(day.stops);
        return {
          stop: day.stops[index] as Stop,
          entry: schedule.entries[index] ?? null,
          dayId: day.id,
          index,
          count: day.stops.length,
        };
      }
    }
    return null;
  }, [detail, selectedStopId]);

  const reorder = useCallback(
    async (dayId: string, orderedStopIds: string[]) => {
      await repo.reorderStops(dayId, orderedStopIds);
      setOptimizeMessages((m) => ({ ...m, [dayId]: '' }));
      await load();
    },
    [repo, load]
  );

  /** Ottimizzazione percorso: euristica in `core/tsp`, esito scritto via `reorderStops`. */
  const optimize = useCallback(
    async (dayId: string) => {
      const day = detail?.days.find((d) => d.id === dayId);
      if (!day) return;
      const result = optimizeRoute(day.stops.map((s) => ({ id: s.id, location: s.location })));
      if (result.changed) {
        await repo.reorderStops(dayId, result.orderedIds);
        await load();
      }
      setOptimizeMessages((m) => ({
        ...m,
        [dayId]: result.changed
          ? t('timeline.optimizeSaved', { distance: formatDistance(result.savedKm) })
          : t('timeline.optimizeAlready'),
      }));
    },
    [detail, repo, load, t]
  );

  const saveStop = useCallback(
    async (stopId: string, patch: StopPatch) => {
      await repo.updateStop(stopId, patch);
      setSelectedStopId(null);
      await load();
    },
    [repo, load]
  );

  /** Sposta la tappa di una posizione: alternativa accessibile al trascinamento. */
  const moveStop = useCallback(
    async (stopId: string, direction: -1 | 1) => {
      if (!selection) return;
      const day = detail?.days.find((d) => d.id === selection.dayId);
      if (!day) return;
      const ids = day.stops.map((s) => s.id);
      const from = ids.indexOf(stopId);
      const to = from + direction;
      if (to < 0 || to >= ids.length) return;
      [ids[from], ids[to]] = [ids[to], ids[from]];
      await repo.reorderStops(day.id, ids);
      await load();
    },
    [selection, detail, repo, load]
  );

  const removeStop = useCallback(
    async (stopId: string) => {
      await repo.removeStop(stopId);
      setSelectedStopId(null);
      await load();
    },
    [repo, load]
  );

  /** Applica un suggerimento di smart scheduling fissando l'orario proposto. */
  const applySuggestion = useCallback(
    async (stopId: string, hour: number) => {
      await repo.updateStop(stopId, { plannedArrival: formatClock(hour * 60) });
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
          {t('timeline.title')}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <Skeleton height={28} width="60%" />
          <Skeleton height={96} />
          <Skeleton height={96} />
        </View>
      ) : !detail ? (
        <EmptyState
          icon={<Clock color={colors.primary} size={36} />}
          title={t('errors.notFound.title')}
          body={t('errors.notFound.body')}
          actionLabel={t('common.back')}
          onAction={() => router.back()}
        />
      ) : !hasStops ? (
        <EmptyState
          icon={<Map color={colors.primary} size={36} />}
          title={t('timeline.empty.title')}
          body={t('timeline.empty.body')}
          actionLabel={t('timeline.empty.cta')}
          onAction={() => router.push(`/itinerary/${id}/map`)}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {detail.days.map((day, index) => (
            <DayTimeline
              key={day.id}
              day={day}
              dayIndex={index}
              onReorder={reorder}
              onOptimize={optimize}
              onSelectStop={setSelectedStopId}
              onApplySuggestion={applySuggestion}
              optimizeMessage={optimizeMessages[day.id] || null}
            />
          ))}

          <Button
            label={t('timeline.empty.cta')}
            variant="outline"
            fullWidth
            leftIcon={<Map color={colors.primary} size={18} />}
            onPress={() => router.push(`/itinerary/${id}/map`)}
          />
        </ScrollView>
      )}

      <StopScheduleSheet
        stop={selection?.stop ?? null}
        entry={selection?.entry ?? null}
        currency={detail?.currency ?? 'EUR'}
        canMoveUp={(selection?.index ?? 0) > 0}
        canMoveDown={selection ? selection.index < selection.count - 1 : false}
        onDismiss={() => setSelectedStopId(null)}
        onSave={saveStop}
        onMove={moveStop}
        onRemove={removeStop}
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
  content: { padding: spacing.lg, gap: spacing['3xl'], paddingBottom: spacing['5xl'] },
});
