/**
 * DayTimeline — una giornata dell'itinerario: intestazione con finestra oraria e totali,
 * fermate riordinabili per trascinamento, e i suggerimenti "meno coda" (dato stimato).
 *
 * Tutto il calcolo sta in `core/schedule`: qui si presenta soltanto.
 */
import { Sparkles, Wand2 } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { CrowdEstimate, Day, Stop } from '@/core/models';
import { getCrowdProvider } from '@/core/providers';
import { computeDaySchedule } from '@/core/schedule/daySchedule';
import { crowdSuggestions } from '@/core/schedule/smartSchedule';
import { formatClock, formatDuration, hourOf, weekdayOf } from '@/core/utils/time';
import { Badge, Button, DraggableList, Text } from '@/ui/components';
import { radius, spacing, useTheme } from '@/ui/theme';
import { ROW_GAP, ROW_HEIGHT, TimelineRow } from './TimelineRow';

type DayWithStops = Day & { stops: Stop[] };

type Props = {
  day: DayWithStops;
  dayIndex: number;
  onReorder: (dayId: string, orderedStopIds: string[]) => void;
  onOptimize: (dayId: string) => void;
  onSelectStop: (stopId: string) => void;
  onApplySuggestion: (stopId: string, hour: number) => void;
  /** Esito dell'ultima ottimizzazione su questa giornata. */
  optimizeMessage?: string | null;
};

export function DayTimeline({
  day,
  dayIndex,
  onReorder,
  onOptimize,
  onSelectStop,
  onApplySuggestion,
  optimizeMessage,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const schedule = useMemo(() => computeDaySchedule(day.stops), [day.stops]);
  const weekday = useMemo(() => weekdayOf(day.date), [day.date]);

  // Affollamento stimato all'ora di arrivo di ogni fermata.
  const crowdByStop = useMemo(() => {
    const provider = getCrowdProvider();
    const map: Record<string, CrowdEstimate> = {};
    for (const entry of schedule.entries) {
      map[entry.stop.id] = provider.estimateCrowd(
        entry.stop.category,
        weekday,
        hourOf(entry.arrivalMin)
      );
    }
    return map;
  }, [schedule, weekday]);

  const suggestions = useMemo(
    () => crowdSuggestions(schedule, weekday, getCrowdProvider()),
    [schedule, weekday]
  );

  const title = day.label ?? t('itineraries.day', { index: dayIndex + 1 });

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="overline" color="textTertiary">
            {title}
          </Text>
          {schedule.entries.length > 0 ? (
            <>
              <Text variant="title2" tabular>
                {t('timeline.range', {
                  start: formatClock(schedule.startMin),
                  end: formatClock(schedule.endMin),
                })}
              </Text>
              <Text variant="footnote" color="textSecondary">
                {t('timeline.summary', {
                  visit: formatDuration(schedule.totalVisitMin),
                  travel: formatDuration(schedule.totalTravelMin),
                })}
              </Text>
            </>
          ) : (
            <Text variant="callout" color="textSecondary">
              {t('timeline.empty.body')}
            </Text>
          )}
        </View>

        {day.stops.length >= 3 ? (
          <Button
            label={t('timeline.optimize')}
            variant="tonal"
            size="sm"
            leftIcon={<Wand2 color={colors.onPrimaryContainer} size={16} />}
            onPress={() => onOptimize(day.id)}
          />
        ) : null}
      </View>

      {optimizeMessage ? <Badge tone="primary" dot label={optimizeMessage} /> : null}

      {day.stops.length > 0 ? (
        <>
          <DraggableList
            data={schedule.entries}
            keyExtractor={(entry) => entry.stop.id}
            itemHeight={ROW_HEIGHT}
            gap={ROW_GAP}
            onReorder={(orderedIds) => onReorder(day.id, orderedIds)}
            handleLabel={t('timeline.reorderHint')}
            renderItem={({ item, index, isActive, handle }) => (
              <TimelineRow
                entry={item}
                position={index + 1}
                isFirst={index === 0}
                crowd={crowdByStop[item.stop.id] ?? null}
                isActive={isActive}
                handle={handle}
                onPress={() => onSelectStop(item.stop.id)}
              />
            )}
          />
          {day.stops.length > 1 ? (
            <Text variant="footnote" color="textTertiary">
              {t('timeline.reorderHint')}
            </Text>
          ) : null}
        </>
      ) : null}

      {/* Smart scheduling: orari alternativi con meno coda (stima). */}
      {suggestions.length > 0 ? (
        <View style={[styles.suggestions, { backgroundColor: colors.surfaceMuted }]}>
          <View style={styles.suggestionsHead}>
            <Sparkles color={colors.primary} size={16} />
            <Text variant="overline" color="textTertiary">
              {t('timeline.suggestions.title')}
            </Text>
            <Badge label={t('common.estimated')} />
          </View>
          {suggestions.map((s, i) => {
            const levelKey =
              s.suggestedLevel === 'basso'
                ? 'low'
                : s.suggestedLevel === 'medio'
                  ? 'medium'
                  : 'high';
            const hour = formatClock(s.suggestedHour * 60);
            return (
              <View
                key={s.stopId}
                style={[
                  styles.suggestion,
                  // Separatore fra un consiglio e il successivo: senza, due righe con lo
                  // stesso testo sembravano un unico blocco ripetuto.
                  i > 0 && [styles.suggestionDivided, { borderTopColor: colors.border }],
                ]}>
                <Text variant="footnote" color="textSecondary">
                  {t('timeline.suggestions.body', {
                    title: s.stopTitle,
                    hour,
                    level: t(`crowd.${levelKey}`).toLowerCase(),
                  })}
                </Text>
                <Button
                  label={t('timeline.suggestions.apply', { hour })}
                  variant="tonal"
                  size="sm"
                  onPress={() => onApplySuggestion(s.stopId, s.suggestedHour)}
                />
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerText: { flex: 1, gap: 2 },
  suggestions: { borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  suggestionsHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // `flex-start`: l'azione deve avere la larghezza del suo testo. Stesa a tutta riga e con
  // il label centrato sembrava un titolo, non un pulsante.
  suggestion: { gap: spacing.sm, alignItems: 'flex-start' },
  suggestionDivided: { paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
});
