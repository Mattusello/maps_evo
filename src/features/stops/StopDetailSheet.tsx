/**
 * StopDetailSheet: bottom sheet (gorhom) con il dettaglio di una tappa.
 * Mostra: stato apertura (quando disponibile), affollamento STIMATO per fascia oraria,
 * prezzo crowdsourced con freschezza e voto, note, link prenotazione, rimozione.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import { ThumbsDown, ThumbsUp } from 'lucide-react-native';

import type { Currency, PriceReport, Stop } from '@/core/models';
import { getCrowdProvider, getPriceProvider } from '@/core/providers';
import { getPriceReportRepository } from '@/core/repositories';
import { formatMoney } from '@/core/utils/format';
import { Badge, Button, Sheet, Text, TextField } from '@/ui/components';
import { spacing, useTheme } from '@/ui/theme';
import { CrowdBars } from './CrowdBars';
import { categoryLabel, useCategoryColor } from './category';
import { CLOSING_SOON_THRESHOLD, getOpenStatus } from './openingHours';

type Props = {
  stop: Stop | null;
  currency: Currency;
  userId: string;
  onDismiss: () => void;
  onRemove: (stopId: string) => void;
};

export function StopDetailSheet({ stop, currency, userId, onDismiss, onRemove }: Props) {
  const { t } = useTranslation();
  // Colore-linea della categoria nel tema attivo (leggibile in chiaro e in scuro).
  const categoryColor = useCategoryColor();
  const { colors } = useTheme();

  const [reports, setReports] = useState<PriceReport[]>([]);
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');

  const priceRepo = useMemo(() => getPriceReportRepository(), []);

  const loadReports = useCallback(
    async (stopId: string) => setReports(await priceRepo.list({ stopId })),
    [priceRepo]
  );

  useEffect(() => {
    if (!stop) return;
    void loadReports(stop.id);
    setAdding(false);
    setAmount('');
  }, [stop, loadReports]);

  const now = new Date();
  const crowd = stop
    ? getCrowdProvider().estimateCrowd(stop.category, now.getDay(), now.getHours())
    : null;
  const curve = stop ? getCrowdProvider().dayCurve(stop.category, now.getDay()) : [];
  const priceInfo = getPriceProvider().getPriceInfo({ reports });
  const openStatus = getOpenStatus(undefined, now); // OSM non fornisce orari → 'unknown'

  const crowdTone =
    crowd?.level === 'basso' ? 'success' : crowd?.level === 'medio' ? 'warning' : 'danger';

  const savePrice = async () => {
    if (!stop) return;
    const value = parseFloat(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) return;
    await priceRepo.add({
      stopId: stop.id,
      price: { amount: value, currency },
      reportedBy: userId,
    });
    setAmount('');
    setAdding(false);
    await loadReports(stop.id);
  };

  const vote = async (id: string, delta: 1 | -1) => {
    await priceRepo.vote(id, delta);
    if (stop) await loadReports(stop.id);
  };

  return (
    <Sheet open={stop !== null} onDismiss={onDismiss} snapPoints={['55%', '92%']}>
      {stop ? (
        <>
          <View style={styles.headerRow}>
            <View style={[styles.dot, { backgroundColor: categoryColor(stop.category) }]} />
            <Text variant="overline" colorValue={categoryColor(stop.category)}>
              {categoryLabel(t, stop.category)}
            </Text>
          </View>
          <Text variant="title1">{stop.title}</Text>

          {/* Orari */}
          <View style={styles.section}>
            {openStatus.kind === 'unknown' ? (
              <Badge label={t('stop.hoursUnavailable')} tone="neutral" />
            ) : openStatus.kind === 'always' ? (
              <Badge label={t('stop.open24')} tone="success" dot />
            ) : openStatus.kind === 'open' ? (
              <Badge
                tone={openStatus.closesInMinutes <= CLOSING_SOON_THRESHOLD ? 'warning' : 'success'}
                dot
                label={
                  openStatus.closesInMinutes <= CLOSING_SOON_THRESHOLD
                    ? t('stop.closingSoon', { minutes: openStatus.closesInMinutes })
                    : `${t('stop.openNow')} · ${t('stop.closesAt', { time: openStatus.closesAt })}`
                }
              />
            ) : (
              <Badge
                tone="danger"
                dot
                label={
                  openStatus.opensAt
                    ? `${t('stop.closedNow')} · ${t('stop.opensAt', { time: openStatus.opensAt })}`
                    : t('stop.closedNow')
                }
              />
            )}
          </View>

          {/* Affollamento stimato */}
          {crowd ? (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text variant="overline" color="textTertiary">
                  {t('stop.crowdLevel')}
                </Text>
                <Badge label={t('common.estimated')} tone="neutral" />
              </View>
              <Badge
                tone={crowdTone}
                dot
                label={t(
                  `crowd.${crowd.level === 'basso' ? 'low' : crowd.level === 'medio' ? 'medium' : 'high'}`
                )}
              />
              <View style={{ marginTop: spacing.sm }}>
                <CrowdBars curve={curve} currentHour={now.getHours()} />
              </View>
              <Text variant="footnote" color="textTertiary" style={{ marginTop: spacing.xs }}>
                {t('crowd.estimatedNote')}
              </Text>
            </View>
          ) : null}

          {/* Prezzo crowdsourced */}
          <View style={styles.section}>
            <Text variant="overline" color="textTertiary">
              {t('stop.realPrice')}
            </Text>
            {priceInfo.crowdPrice ? (
              <View style={styles.priceRow}>
                <Text variant="title2">
                  {formatMoney(priceInfo.crowdPrice.amount, priceInfo.crowdPrice.currency)}
                </Text>
                <Badge
                  tone={
                    priceInfo.freshnessDays == null || priceInfo.freshnessDays <= 30
                      ? 'success'
                      : priceInfo.freshnessDays <= 120
                        ? 'warning'
                        : 'danger'
                  }
                  label={
                    priceInfo.freshnessDays === 0
                      ? t('stop.priceToday')
                      : t('stop.priceDaysAgo', { count: priceInfo.freshnessDays ?? 0 })
                  }
                />
              </View>
            ) : (
              <Text variant="callout" color="textSecondary">
                {t('stop.noPrice')}
              </Text>
            )}

            {/* Voto sul report migliore */}
            {reports.length > 0 ? (
              <View style={styles.voteRow}>
                <Button
                  label={t('stop.voteUseful')}
                  variant="ghost"
                  size="sm"
                  leftIcon={<ThumbsUp color={colors.primary} size={16} />}
                  onPress={() => vote(bestReportId(reports), 1)}
                />
                <Button
                  label={t('stop.voteOutdated')}
                  variant="ghost"
                  size="sm"
                  leftIcon={<ThumbsDown color={colors.textSecondary} size={16} />}
                  onPress={() => vote(bestReportId(reports), -1)}
                />
              </View>
            ) : null}

            {adding ? (
              <View style={styles.addPrice}>
                <TextField
                  placeholder={t('stop.pricePlaceholder')}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  autoFocus
                />
                <Button label={t('common.save')} onPress={savePrice} />
              </View>
            ) : (
              <Button
                label={priceInfo.crowdPrice ? t('stop.updatePrice') : t('stop.addPrice')}
                variant="tonal"
                size="sm"
                onPress={() => setAdding(true)}
              />
            )}
          </View>

          {/* Prenotazione */}
          {stop.bookingUrl ? (
            <Button
              label={t('stop.book')}
              variant="outline"
              onPress={() => Linking.openURL(stop.bookingUrl!)}
            />
          ) : null}

          {/* Note */}
          {stop.notes ? (
            <View style={styles.section}>
              <Text variant="overline" color="textTertiary">
                {t('stop.notes')}
              </Text>
              <Text variant="body">{stop.notes}</Text>
            </View>
          ) : null}

          <Button label={t('stop.remove')} variant="ghost" onPress={() => onRemove(stop.id)} />
        </>
      ) : null}
    </Sheet>
  );
}

/** Id del report "migliore" (stesso criterio del PriceProvider: voti, poi recente). */
function bestReportId(reports: PriceReport[]): string {
  return [...reports].sort((a, b) => {
    const s = b.upvotes - b.downvotes - (a.upvotes - a.downvotes);
    return s !== 0 ? s : b.createdAt.localeCompare(a.createdAt);
  })[0].id;
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  section: { gap: spacing.xs },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  voteRow: { flexDirection: 'row', gap: spacing.sm },
  addPrice: { gap: spacing.sm },
});
