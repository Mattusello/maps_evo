/**
 * Sheet (web) — stessa API della versione nativa, ma costruito con primitive che sul web
 * funzionano sempre: un velo scuro premibile e un pannello ancorato in basso, con entrata
 * animata (Animated di React Native, non Reanimated) e scorrimento interno.
 *
 * Perché non gorhom qui: vedi il commento in `Sheet.tsx`.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useReducedMotion } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import { duration, elevation, radius, spacing } from '../theme/tokens';

export type SheetProps = {
  open: boolean;
  onDismiss: () => void;
  /** Ignorato sul web: il pannello si adatta al contenuto fino al 92% dell'altezza. */
  snapPoints?: string[];
  children: ReactNode;
};

export function Sheet({ open, onDismiss, children }: SheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  // `visible` resta true finché l'uscita non è finita, così l'animazione si vede.
  const [visible, setVisible] = useState(open);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) setVisible(true);
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      // Con "Riduci movimento" il pannello compare e sparisce senza scorrere.
      duration: reducedMotion ? 0 : open ? duration.base : duration.fast,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      // Sul web non esiste il driver nativo: chiederlo produce solo un warning.
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !open) setVisible(false);
    });
  }, [open, progress, reducedMotion]);

  if (!visible) return null;

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [reducedMotion ? 0 : 40, 0],
  });

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          elevation.lg,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: progress,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(11, 12, 16, 0.4)' },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '92%',
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['3xl'] },
});
