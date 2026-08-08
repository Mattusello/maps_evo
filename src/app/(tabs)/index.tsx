import { useRouter } from 'expo-router';
import { MapPinned, Plus, QrCode } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { useItineraries } from '@/context/ItinerariesContext';
import type { Itinerary } from '@/core/models';
import { ItineraryCard } from '@/features/itineraries/components/ItineraryCard';
import {
  Button,
  ConfirmSheet,
  EmptyState,
  Fab,
  Screen,
  Skeleton,
  SwipeableRow,
  Text,
} from '@/ui/components';
import { minTapTarget, spacing, useTheme } from '@/ui/theme';

export default function ItinerariesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { itineraries, loading, error, refresh, deleteItinerary } = useItineraries();

  // L'itinerario in attesa di conferma. Lo teniamo intero, non solo l'id: serve il titolo
  // nella domanda, e la card sotto potrebbe già essere sparita dalla lista.
  const [pendingDelete, setPendingDelete] = useState<Itinerary | null>(null);

  const openNew = () => router.push('/itinerary/new');
  const openImport = () => router.push('/import');

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    await deleteItinerary(target.id);
  };

  return (
    <Screen edges={['top']}>
      {loading && itineraries.length === 0 ? (
        <View style={styles.listContent}>
          <Header count={0} onImport={openImport} />
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <Skeleton height={20} width="70%" />
              <Skeleton height={14} width="40%" />
            </View>
          ))}
        </View>
      ) : itineraries.length === 0 ? (
        // Un itinerario può anche arrivare da fuori: la seconda via è dichiarata subito.
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={<MapPinned color={colors.primary} size={36} />}
            title={t('itineraries.empty.title')}
            body={t('itineraries.empty.body')}
            actionLabel={t('itineraries.empty.cta')}
            onAction={openNew}
          />
          <View style={styles.emptySecondary}>
            <Button
              label={t('sharing.import.cta')}
              variant="ghost"
              fullWidth
              leftIcon={<QrCode color={colors.primary} size={18} />}
              onPress={openImport}
            />
          </View>
        </View>
      ) : (
        <FlatList
          data={itineraries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={<Header count={itineraries.length} onImport={openImport} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <SwipeableRow
              actionLabel={t('itineraries.delete.action')}
              onAction={() => setPendingDelete(item)}>
              <ItineraryCard
                itinerary={item}
                dayCount={item.dayIds.length}
                onPress={() => router.push(`/itinerary/${item.id}`)}
              />
            </SwipeableRow>
          )}
        />
      )}

      <ConfirmSheet
        open={pendingDelete !== null}
        title={t('itineraries.delete.title', { title: pendingDelete?.title ?? '' })}
        body={t('itineraries.delete.body')}
        confirmLabel={t('itineraries.delete.confirm')}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {error ? (
        <Text variant="footnote" color="danger" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {itineraries.length > 0 ? (
        <Fab
          icon={<Plus color={colors.onPrimary} size={22} />}
          label={t('itineraries.empty.cta')}
          onPress={openNew}
        />
      ) : null}
    </Screen>
  );
}

function Header({ count, onImport }: { count: number; onImport: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text variant="display">{t('itineraries.title')}</Text>
        <Text variant="subhead" color="textSecondary">
          {t('itineraries.count', { count })}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('sharing.import.cta')}
        onPress={onImport}
        hitSlop={10}
        style={styles.headerAction}>
        <QrCode color={colors.text} size={22} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: spacing.lg, paddingBottom: spacing['6xl'], gap: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  headerText: { gap: spacing.xs, flex: 1 },
  headerAction: {
    width: minTapTarget,
    height: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.md,
  },
  emptyWrap: { flex: 1 },
  emptySecondary: { paddingHorizontal: spacing['3xl'], paddingBottom: spacing['3xl'] },
  skeletonCard: { gap: spacing.sm, padding: spacing.lg },
  error: { textAlign: 'center', padding: spacing.md },
});
