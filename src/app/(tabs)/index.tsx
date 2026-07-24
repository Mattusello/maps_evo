import { useRouter } from 'expo-router';
import { MapPinned, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { useItineraries } from '@/context/ItinerariesContext';
import { ItineraryCard } from '@/features/itineraries/components/ItineraryCard';
import { EmptyState, Fab, Screen, Skeleton, Text } from '@/ui/components';
import { spacing, useTheme } from '@/ui/theme';

export default function ItinerariesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { itineraries, loading, error, refresh } = useItineraries();

  const openNew = () => router.push('/itinerary/new');

  return (
    <Screen edges={['top']}>
      {loading && itineraries.length === 0 ? (
        <View style={styles.listContent}>
          <Header count={0} />
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <Skeleton height={20} width="70%" />
              <Skeleton height={14} width="40%" />
            </View>
          ))}
        </View>
      ) : itineraries.length === 0 ? (
        <EmptyState
          icon={<MapPinned color={colors.primary} size={36} />}
          title={t('itineraries.empty.title')}
          body={t('itineraries.empty.body')}
          actionLabel={t('itineraries.empty.cta')}
          onAction={openNew}
        />
      ) : (
        <FlatList
          data={itineraries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={<Header count={itineraries.length} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <ItineraryCard
              itinerary={item}
              dayCount={item.dayIds.length}
              onPress={() => router.push(`/itinerary/${item.id}`)}
            />
          )}
        />
      )}

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

function Header({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      <Text variant="display">{t('itineraries.title')}</Text>
      <Text variant="subhead" color="textSecondary">
        {t('itineraries.count', { count })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: spacing.lg, paddingBottom: spacing['6xl'], gap: spacing.md },
  header: { gap: spacing.xs, marginBottom: spacing.sm },
  skeletonCard: { gap: spacing.sm, padding: spacing.lg },
  error: { textAlign: 'center', padding: spacing.md },
});
