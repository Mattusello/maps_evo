import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import type { ItineraryWithDetails, Location, Stop } from '@/core/models';
import { getPoiProvider, type PoiSuggestion } from '@/core/providers';
import { getItineraryRepository } from '@/core/repositories';
import { MapCanvas } from '@/features/map/MapCanvas';
import type { MapMarker } from '@/features/map/MapCanvas.types';
import { PoiSearchBar } from '@/features/map/PoiSearchBar';
import { categoryColor } from '@/features/stops/category';
import { StopDetailSheet } from '@/features/stops/StopDetailSheet';
import { elevation, spacing, useTheme } from '@/ui/theme';

export default function ItineraryMapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const repo = useMemo(() => getItineraryRepository(), []);

  const [detail, setDetail] = useState<ItineraryWithDetails | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (id) setDetail(await repo.get(id));
  }, [id, repo]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // Tutte le tappe in ordine, con indice progressivo per la linea-percorso.
  const stops: Stop[] = useMemo(
    () => detail?.days.flatMap((d) => d.stops) ?? [],
    [detail]
  );

  const markers: MapMarker[] = useMemo(
    () =>
      stops.map((s, i) => ({
        id: s.id,
        lat: s.location.lat,
        lng: s.location.lng,
        color: categoryColor(s.category),
        label: s.title,
        index: i + 1,
      })),
    [stops]
  );

  const selectedStop = stops.find((s) => s.id === selectedStopId) ?? null;
  const near: Location | undefined = stops[0]?.location;

  /** Garantisce l'esistenza di un giorno e restituisce l'id dell'ultimo. */
  const ensureDayId = useCallback(async (): Promise<string> => {
    const current = await repo.get(id!);
    if (current && current.days.length > 0) return current.days[current.days.length - 1].id;
    const day = await repo.addDay(id!);
    return day.id;
  }, [id, repo]);

  const addStop = useCallback(
    async (s: PoiSuggestion) => {
      const dayId = await ensureDayId();
      await repo.addStop(dayId, {
        title: s.name,
        category: s.category,
        location: s.location,
        poiRef: s.placeId,
      });
      await load();
    },
    [ensureDayId, repo, load]
  );

  const addAtPoint = useCallback(
    async (loc: Location) => {
      // Geocoding inverso per dare un nome sensato al punto toccato.
      const found = await getPoiProvider().reverseGeocode(loc);
      await addStop(found ?? { placeId: `pt${loc.lat},${loc.lng}`, name: t('map.customStop'), category: 'altro', location: loc });
    },
    [addStop, t]
  );

  const removeStop = useCallback(
    async (stopId: string) => {
      await repo.removeStop(stopId);
      setSelectedStopId(null);
      await load();
    },
    [repo, load]
  );

  return (
    <View style={styles.root}>
      <MapCanvas
        markers={markers}
        routeColor={colors.primary}
        center={near}
        onMapPress={addAtPoint}
        onMarkerPress={setSelectedStopId}
        style={StyleSheet.absoluteFill}
      />

      {/* Overlay in alto: back + ricerca */}
      <View style={[styles.overlay, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.surface }, elevation.md]}>
            <ArrowLeft color={colors.text} size={22} />
          </Pressable>
        </View>
        <PoiSearchBar near={near} onSelect={addStop} />
      </View>

      <StopDetailSheet
        stop={selectedStop}
        currency={detail?.currency ?? 'EUR'}
        userId={user?.id ?? 'local'}
        onDismiss={() => setSelectedStopId(null)}
        onRemove={removeStop}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { position: 'absolute', left: spacing.lg, right: spacing.lg, gap: spacing.sm },
  topRow: { flexDirection: 'row' },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
