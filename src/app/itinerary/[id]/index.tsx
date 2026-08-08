import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  CalendarPlus,
  Clock,
  Map,
  MapPinned,
  PiggyBank,
  Share2,
  Trash2,
  Users,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { useItineraries } from '@/context/ItinerariesContext';
import { getItineraryRepository } from '@/core/repositories';
import type { Collaborator, ItineraryWithDetails } from '@/core/models';
import { CollaboratorsSheet } from '@/features/sharing/CollaboratorsSheet';
import { ShareSheet } from '@/features/sharing/ShareSheet';
import {
  Badge,
  Button,
  Card,
  ConfirmSheet,
  EmptyState,
  HeaderIconButton,
  Screen,
  ScreenHeader,
  Skeleton,
  Text,
} from '@/ui/components';
import { spacing, useTheme } from '@/ui/theme';

export default function ItineraryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { deleteItinerary } = useItineraries();
  const repo = useMemo(() => getItineraryRepository(), []);

  const [detail, setDetail] = useState<ItineraryWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [editingCollaborators, setEditingCollaborators] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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

  /** La lista collaboratori vive sull'itinerario: si salva come qualsiasi altro campo. */
  const saveCollaborators = async (collaborators: Collaborator[]) => {
    if (!id) return;
    await repo.update(id, { collaborators });
    await load();
  };

  /**
   * L'eliminazione passa dal context, non dal repository: così la lista si aggiorna da sola
   * invece di scoprire alla prossima lettura che l'itinerario non c'è più.
   */
  const confirmDelete = async () => {
    if (!id) return;
    setConfirmingDelete(false);
    await deleteItinerary(id);
    router.back();
  };

  const stopCount = detail?.days.reduce((n, d) => n + d.stops.length, 0) ?? 0;

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        backLabel={t('common.back')}
        onBack={() => router.back()}
        actions={
          detail ? (
            <>
              <HeaderIconButton
                accessibilityLabel={t('sharing.collaborators')}
                onPress={() => setEditingCollaborators(true)}>
                <Users color={colors.text} size={22} />
              </HeaderIconButton>
              <HeaderIconButton
                accessibilityLabel={t('sharing.title')}
                onPress={() => setSharing(true)}>
                <Share2 color={colors.text} size={22} />
              </HeaderIconButton>
              <HeaderIconButton
                accessibilityLabel={t('itineraries.delete.accessibility')}
                onPress={() => setConfirmingDelete(true)}>
                <Trash2 color={colors.danger} size={22} />
              </HeaderIconButton>
            </>
          ) : null
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        {loading && !detail ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={32} width="80%" />
            <Skeleton height={18} width="50%" />
          </View>
        ) : !detail ? (
          <EmptyState
            icon={<MapPinned color={colors.primary} size={36} />}
            title={t('errors.notFound.title')}
            body={t('errors.notFound.body')}
            actionLabel={t('common.back')}
            onAction={() => router.back()}
          />
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
                {detail.collaborators.length > 1 ? (
                  <Badge
                    icon={<Users color={colors.textSecondary} size={12} />}
                    label={t('sharing.collaboratorsCount', { count: detail.collaborators.length })}
                  />
                ) : null}
              </View>
            </View>

            {/* Azioni verso le viste dell'itinerario (Mappa/Timeline/Budget). */}
            <View style={styles.actions}>
              <ActionTile
                icon={<Map color={colors.primary} size={22} />}
                label={t('map.title')}
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
                      {t('itineraries.dayEmpty')}
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
                label={t('itineraries.addDay')}
                variant="tonal"
                fullWidth
                leftIcon={<CalendarPlus color={colors.onPrimaryContainer} size={18} />}
                onPress={addDay}
              />
            </View>
          </>
        )}
      </ScrollView>

      <ShareSheet detail={detail} open={sharing} onDismiss={() => setSharing(false)} />
      <CollaboratorsSheet
        open={editingCollaborators}
        onDismiss={() => setEditingCollaborators(false)}
        collaborators={detail?.collaborators ?? []}
        currentUserId={user?.id ?? 'local'}
        onChange={saveCollaborators}
      />
      <ConfirmSheet
        open={confirmingDelete}
        title={t('itineraries.delete.title', { title: detail?.title ?? '' })}
        body={t('itineraries.delete.body')}
        confirmLabel={t('itineraries.delete.confirm')}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
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
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing['4xl'] },
  head: { gap: spacing.sm },
  badges: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.md },
  tile: { flex: 1 },
  tileInner: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
});
