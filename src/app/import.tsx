/**
 * Rotta `/import` — porta dentro l'app un itinerario ricevuto.
 *
 * È il bersaglio del link profondo (`mymappa://import?c=…`, quindi anche del QR): se il
 * codice arriva nell'URL viene letto subito, altrimenti si incolla a mano. Prima di scrivere
 * qualcosa mostra sempre un'**anteprima**: l'utente vede cosa sta aggiungendo.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ClipboardPaste, Check, QrCode, TriangleAlert } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useItineraries } from '@/context/ItinerariesContext';
import {
  parseShareInput,
  ShareParseError,
  summarizeShared,
  type SharedItinerary,
} from '@/core/sharing/shareCode';
import { readClipboard } from '@/features/sharing/shareActions';
import { Badge, Button, Card, Screen, ScreenHeader, Text, TextField } from '@/ui/components';
import { radius, spacing, useTheme } from '@/ui/theme';

export default function ImportScreen() {
  const { c } = useLocalSearchParams<{ c?: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { importShared } = useItineraries();

  const [text, setText] = useState(c ?? '');
  const [shared, setShared] = useState<SharedItinerary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const read = useCallback(
    (value: string) => {
      try {
        setShared(parseShareInput(value));
        setError(null);
      } catch (e) {
        setShared(null);
        setError(
          e instanceof ShareParseError && e.reason === 'version'
            ? t('sharing.import.version')
            : t('sharing.import.invalid')
        );
      }
    },
    [t]
  );

  // Codice arrivato dal link/QR: si legge da solo, senza far ricopiare nulla all'utente.
  useEffect(() => {
    if (c) read(c);
  }, [c, read]);

  const paste = async () => {
    const clip = (await readClipboard()).trim();
    if (!clip) {
      setError(t('sharing.import.clipboardEmpty'));
      return;
    }
    setText(clip);
    read(clip);
  };

  const confirm = async () => {
    if (!shared) return;
    setBusy(true);
    try {
      const item = await importShared(shared);
      router.replace(`/itinerary/${item.id}`);
    } catch {
      setError(t('sharing.import.failed'));
      setBusy(false);
    }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const summary = shared ? summarizeShared(shared) : null;

  return (
    <Screen edges={['top']}>
      <ScreenHeader backLabel={t('common.back')} onBack={close} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <View style={[styles.medallion, { backgroundColor: colors.primaryContainer }]}>
            <QrCode color={colors.primary} size={28} />
          </View>
          <Text variant="display">{t('sharing.import.title')}</Text>
          <Text variant="callout" color="textSecondary">
            {t('sharing.import.body')}
          </Text>
        </View>

        {summary ? (
          <>
            <Card padding="lg">
              <View style={styles.preview}>
                <Text variant="overline" color="textTertiary">
                  {t('sharing.import.preview')}
                </Text>
                <Text variant="title2">{summary.title}</Text>
                {summary.description ? (
                  <Text variant="callout" color="textSecondary">
                    {summary.description}
                  </Text>
                ) : null}
                <View style={styles.badges}>
                  <Badge tone="primary" dot label={t('itineraries.days', { count: summary.dayCount })} />
                  <Badge label={t('itineraries.stops', { count: summary.stopCount })} />
                  <Badge label={t('budget.people', { count: summary.partySize })} />
                  <Badge label={summary.currency} />
                </View>
              </View>
            </Card>

            <View style={styles.actions}>
              <Button
                label={t('sharing.import.confirm')}
                fullWidth
                loading={busy}
                leftIcon={<Check color={colors.onPrimary} size={18} />}
                onPress={() => void confirm()}
              />
              <Button
                label={t('sharing.import.other')}
                variant="ghost"
                fullWidth
                disabled={busy}
                onPress={() => {
                  setShared(null);
                  setText('');
                }}
              />
            </View>

            <Text variant="footnote" color="textTertiary">
              {t('sharing.import.copyNote')}
            </Text>
          </>
        ) : (
          <>
            <TextField
              label={t('sharing.import.field')}
              placeholder={t('sharing.import.placeholder')}
              value={text}
              onChangeText={setText}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            <View style={styles.actions}>
              <Button
                label={t('sharing.import.read')}
                fullWidth
                disabled={!text.trim()}
                onPress={() => read(text)}
              />
              <Button
                label={t('sharing.import.paste')}
                variant="tonal"
                fullWidth
                leftIcon={<ClipboardPaste color={colors.onPrimaryContainer} size={18} />}
                onPress={() => void paste()}
              />
            </View>
          </>
        )}

        {error ? (
          <View style={[styles.error, { backgroundColor: colors.dangerContainer }]}>
            <TriangleAlert color={colors.danger} size={18} />
            <Text variant="footnote" color="danger" style={styles.errorText}>
              {error}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing['4xl'] },
  head: { gap: spacing.sm },
  medallion: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  preview: { gap: spacing.sm },
  badges: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.xs },
  actions: { gap: spacing.sm },
  input: { minHeight: 96, textAlignVertical: 'top' },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  errorText: { flex: 1 },
});
