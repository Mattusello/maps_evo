/**
 * ItineraryCard: riga della lista itinerari. Mostra la linea-percorso (RouteStrip),
 * il titolo in font display e i metadati (giorni, tappe) come badge da legenda.
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Itinerary } from '@/core/models';
import { Badge, Card, Text } from '@/ui/components';
import { spacing } from '@/ui/theme';
import { RouteStrip } from './RouteStrip';

export function ItineraryCard({
  itinerary,
  dayCount,
  stopCount,
  onPress,
}: {
  itinerary: Itinerary;
  dayCount: number;
  /** Numero di tappe, se già noto (dal dettaglio). Nella lista può mancare. */
  stopCount?: number;
  onPress: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Card interactive onPress={onPress} padding="lg">
      <View style={styles.row}>
        <RouteStrip count={Math.max(stopCount ?? dayCount, 1)} />
        <View style={styles.body}>
          <Text variant="title3" numberOfLines={2}>
            {itinerary.title}
          </Text>
          {itinerary.description ? (
            <Text variant="footnote" color="textSecondary" numberOfLines={1}>
              {itinerary.description}
            </Text>
          ) : null}
          <View style={styles.badges}>
            <Badge label={t('itineraries.days', { count: dayCount })} dot tone="primary" />
            {stopCount != null ? (
              <Badge label={t('itineraries.stops', { count: stopCount })} />
            ) : null}
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.lg, alignItems: 'stretch' },
  body: { flex: 1, gap: spacing.xs, justifyContent: 'center' },
  badges: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
});
