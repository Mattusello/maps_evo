/**
 * TimelineRow — una fermata della giornata.
 *
 * Struttura da segnaletica: colonna oraria a sinistra (cifre tabellari, incolonnate),
 * linea-percorso con il dot del colore-categoria al centro, contenuto a destra.
 * Sopra la riga, la tratta di spostamento con cui ci si arriva: fa parte della riga
 * (altezza fissa) perché la lista riordinabile lavora con righe di altezza uniforme.
 */
import { Footprints, Route } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CrowdEstimate } from '@/core/models';
import type { ScheduleEntry } from '@/core/schedule/daySchedule';
import { formatDistance, formatMoney } from '@/core/utils/format';
import { formatClock, formatDuration } from '@/core/utils/time';
import { categoryColor, categoryLabel } from '@/features/stops/category';
import { Badge, Text } from '@/ui/components';
import { elevation, radius, spacing, useTheme } from '@/ui/theme';

/** Altezze fisse: la lista riordinabile ha bisogno di righe tutte uguali. */
export const LEG_HEIGHT = 22;
export const BODY_HEIGHT = 72;
export const ROW_HEIGHT = LEG_HEIGHT + BODY_HEIGHT;
export const ROW_GAP = 6;

type Props = {
  entry: ScheduleEntry;
  /** Numero della fermata (1-based), come sui marker della mappa. */
  position: number;
  isFirst: boolean;
  crowd: CrowdEstimate | null;
  isActive: boolean;
  handle: ReactNode;
  onPress: () => void;
};

export function TimelineRow({ entry, position, isFirst, crowd, isActive, handle, onPress }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const color = categoryColor(entry.stop.category);

  const crowdTone =
    crowd?.level === 'basso' ? 'success' : crowd?.level === 'medio' ? 'warning' : 'danger';
  const crowdKey = crowd?.level === 'basso' ? 'low' : crowd?.level === 'medio' ? 'medium' : 'high';

  return (
    <View style={styles.root}>
      {/* Tratta di arrivo: a piedi o motorizzata, sempre dichiarata come stima. */}
      <View style={styles.leg}>
        {isFirst ? (
          <>
            <View style={[styles.legLine, { backgroundColor: colors.border }]} />
            <Text variant="caption" color="textTertiary">
              {t('timeline.start')}
            </Text>
          </>
        ) : (
          <>
            <View style={[styles.legLine, { backgroundColor: colors.border }]} />
            {entry.travelMode === 'walk' ? (
              <Footprints color={colors.textTertiary} size={13} />
            ) : (
              <Route color={colors.textTertiary} size={13} />
            )}
            <Text variant="caption" color="textTertiary" numberOfLines={1}>
              {t(`timeline.travel.${entry.travelMode}`, { minutes: entry.travelMin })}
              {entry.travelKm > 0 ? ` · ${formatDistance(entry.travelKm)}` : ''}
            </Text>
          </>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${entry.stop.title}, ${formatClock(entry.arrivalMin)}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.body,
          {
            backgroundColor: colors.surface,
            borderColor: isActive ? colors.primary : colors.border,
          },
          isActive && elevation.lg,
          pressed && styles.pressed,
        ]}
      >
        {/* Colonna oraria */}
        <View style={styles.timeCol}>
          <Text variant="headline" tabular color={entry.conflict ? 'danger' : 'text'}>
            {formatClock(entry.arrivalMin)}
          </Text>
          <Text variant="caption" color="textTertiary" tabular>
            {formatDuration(entry.durationMin)}
          </Text>
        </View>

        {/* Linea-percorso con la fermata */}
        <View style={styles.routeCol} accessibilityElementsHidden importantForAccessibility="no">
          <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
          <View style={[styles.dot, { borderColor: color, backgroundColor: colors.surface }]}>
            <Text variant="caption" colorValue={color} tabular style={styles.dotLabel}>
              {position}
            </Text>
          </View>
        </View>

        {/* Contenuto */}
        <View style={styles.content}>
          <Text variant="title3" numberOfLines={1}>
            {entry.stop.title}
          </Text>
          <View style={styles.meta}>
            <Text variant="caption" colorValue={color} numberOfLines={1}>
              {categoryLabel(t, entry.stop.category)}
            </Text>
            {entry.conflict ? (
              <Badge tone="danger" dot label={t('timeline.conflict')} />
            ) : crowd ? (
              <Badge tone={crowdTone} dot label={t(`crowd.${crowdKey}`)} />
            ) : null}
            {entry.stop.cost ? (
              <Text variant="caption" color="textSecondary" tabular>
                {formatMoney(entry.stop.cost.amount, entry.stop.cost.currency)}
              </Text>
            ) : null}
            {entry.arrivalIsPinned ? (
              <Text variant="caption" color="textTertiary" numberOfLines={1}>
                {t('timeline.pinned')}
              </Text>
            ) : null}
          </View>
        </View>

        {handle}
      </Pressable>
    </View>
  );
}

const DOT = 22;

const styles = StyleSheet.create({
  root: { flex: 1 },
  leg: {
    height: LEG_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.xs,
  },
  legLine: { width: 2, height: LEG_HEIGHT - 6, borderRadius: 1, marginLeft: 33 },
  body: {
    height: BODY_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.92 },
  timeCol: { width: 52 },
  routeCol: { width: DOT, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  routeLine: { position: 'absolute', top: 0, bottom: 0, width: 2 },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotLabel: { fontSize: 11, lineHeight: 13 },
  content: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
