/**
 * ShareSheet — foglio "Condividi itinerario".
 *
 * Tre strade per lo stesso contenuto, in ordine di immediatezza: **QR** da inquadrare,
 * **link** da mandare in chat, **codice/JSON** da incollare dove il link non arriva.
 * Il QR compare solo se il codice ci sta davvero (vedi `QR_MAX_CHARS`): meglio dire
 * "usa il link" che mostrare un quadrato illeggibile.
 */
import { Check, Copy, FileJson, Link2, Share2 } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import type { ItineraryWithDetails } from '@/core/models';
import { encodeShareCode, exportItineraryJson, fitsInQr } from '@/core/sharing/shareCode';
import { buildShareUrl } from '@/core/sharing/shareLink';
import { Button, Sheet, Text } from '@/ui/components';
import { duration, lightColors, radius, spacing, useReducedMotion, useTheme } from '@/ui/theme';

import { copyToClipboard, shareOrCopy } from './shareActions';

/**
 * Il QR va grande: a `QR_MAX_CHARS` il reticolo è di 121×121 moduli, e sotto i ~2 px per
 * modulo un telefono non lo aggancia più. Resta comunque scuro su chiaro anche in dark mode,
 * altrimenti molti lettori lo ignorano.
 */
const QR_MAX_SIZE = 280;
const QR_PLATE_PADDING = spacing.md;

export type ShareSheetProps = {
  detail: ItineraryWithDetails | null;
  open: boolean;
  onDismiss: () => void;
};

export function ShareSheet({ detail, open, onDismiss }: ShareSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [feedback, setFeedback] = useState<string | null>(null);

  const { code, url, json, qrOk } = useMemo(() => {
    if (!detail) return { code: '', url: '', json: '', qrOk: false };
    const nextCode = encodeShareCode(detail);
    const nextUrl = buildShareUrl(nextCode);
    return {
      code: nextCode,
      url: nextUrl,
      json: exportItineraryJson(detail),
      // È il link, non il solo codice, quello che finisce dentro il QR.
      qrOk: fitsInQr(nextUrl),
    };
  }, [detail]);

  // Il QR non deve mai eccedere la larghezza del foglio (schermi piccoli inclusi).
  const qrSize = Math.min(QR_MAX_SIZE, width - spacing.lg * 4 - QR_PLATE_PADDING * 2);

  // --- Movimento ---
  // Momento d'autore della Fase 4: il QR *arriva*, una volta sola, appena il foglio si è
  // posato. È l'istante in cui l'itinerario esce dal telefono, e nient'altro qui si muove.
  const reducedMotion = useReducedMotion();
  const qrEntrance = useRef(new Animated.Value(0)).current;
  const feedbackEntrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!open) {
      qrEntrance.setValue(0);
      return;
    }
    if (reducedMotion) {
      qrEntrance.setValue(1);
      return;
    }
    const animation = Animated.timing(qrEntrance, {
      toValue: 1,
      duration: duration.base,
      delay: 120, // il foglio è già fermo: l'arrivo si legge come un gesto distinto
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [open, reducedMotion, qrEntrance]);

  // Il messaggio di conferma entra breve ed esce ancora più in fretta.
  useEffect(() => {
    if (!feedback) return;
    Animated.timing(feedbackEntrance, {
      toValue: 1,
      duration: reducedMotion ? 0 : duration.fast,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(feedbackEntrance, {
        toValue: 0,
        duration: reducedMotion ? 0 : 100,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) setFeedback(null);
      });
    }, 2500);
    return () => clearTimeout(timer);
  }, [feedback, feedbackEntrance, reducedMotion]);

  useEffect(() => {
    if (!open) {
      setFeedback(null);
      feedbackEntrance.setValue(0);
    }
  }, [open, feedbackEntrance]);

  const run = async (action: () => Promise<string | null>) => {
    setFeedback(await action());
  };

  if (!detail) return null;

  return (
    <Sheet open={open} onDismiss={onDismiss} snapPoints={['85%']}>
      <View style={styles.head}>
        <Text variant="overline" color="textTertiary">
          {t('sharing.title')}
        </Text>
        <Text variant="title2">{detail.title}</Text>
      </View>

      {qrOk ? (
        <Animated.View
          style={[
            styles.qrWrap,
            {
              opacity: qrEntrance,
              transform: [
                {
                  translateY: qrEntrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}>
          <View style={[styles.qrPlate, { backgroundColor: lightColors.surface }]}>
            <QRCode
              value={url}
              size={qrSize}
              color={lightColors.text}
              backgroundColor={lightColors.surface}
              ecl="L"
            />
          </View>
          <Text variant="footnote" color="textSecondary" style={styles.center}>
            {t('sharing.qrHint')}
          </Text>
        </Animated.View>
      ) : (
        <View style={[styles.notice, { backgroundColor: colors.surfaceMuted }]}>
          <Text variant="footnote" color="textSecondary">
            {t('sharing.qrTooBig')}
          </Text>
        </View>
      )}

      <View style={[styles.linkBox, { backgroundColor: colors.surfaceMuted }]}>
        <Link2 color={colors.textTertiary} size={16} />
        <Text variant="footnote" color="textSecondary" numberOfLines={2} selectable style={styles.linkText}>
          {url}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          label={t('sharing.share')}
          fullWidth
          leftIcon={<Share2 color={colors.onPrimary} size={18} />}
          onPress={() =>
            run(async () => {
              const outcome = await shareOrCopy({ title: detail.title, message: url });
              if (outcome === 'copied') return t('sharing.copiedLinkFallback');
              return null;
            })
          }
        />

        <View style={styles.row}>
          <View style={styles.grow}>
            <Button
              label={t('sharing.copyLink')}
              variant="tonal"
              fullWidth
              leftIcon={<Copy color={colors.onPrimaryContainer} size={18} />}
              onPress={() =>
                run(async () => {
                  await copyToClipboard(url);
                  return t('sharing.copiedLink');
                })
              }
            />
          </View>
          <View style={styles.grow}>
            <Button
              label={t('sharing.copyCode')}
              variant="tonal"
              fullWidth
              leftIcon={<Copy color={colors.onPrimaryContainer} size={18} />}
              onPress={() =>
                run(async () => {
                  await copyToClipboard(code);
                  return t('sharing.copiedCode');
                })
              }
            />
          </View>
        </View>

        <Button
          label={t('sharing.copyJson')}
          variant="ghost"
          fullWidth
          leftIcon={<FileJson color={colors.primary} size={18} />}
          onPress={() =>
            run(async () => {
              await copyToClipboard(json);
              return t('sharing.copiedJson');
            })
          }
        />
      </View>

      {feedback ? (
        <Animated.View
          accessibilityLiveRegion="polite"
          style={[
            styles.feedback,
            {
              opacity: feedbackEntrance,
              transform: [
                {
                  translateY: feedbackEntrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [2, 0],
                  }),
                },
              ],
            },
          ]}>
          <Check color={colors.success} size={16} />
          <Text variant="footnote" color="success">
            {feedback}
          </Text>
        </Animated.View>
      ) : null}

      <Text variant="footnote" color="textTertiary">
        {t('sharing.copyNote')}
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs },
  qrWrap: { alignItems: 'center', gap: spacing.sm },
  qrPlate: { padding: QR_PLATE_PADDING, borderRadius: radius.lg },
  center: { textAlign: 'center' },
  notice: { padding: spacing.md, borderRadius: radius.md },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  linkText: { flex: 1 },
  actions: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
