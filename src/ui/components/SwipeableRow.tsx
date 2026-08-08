/**
 * SwipeableRow — scopre un'azione distruttiva trascinando la riga verso sinistra.
 *
 * Fatta in casa come `DraggableList`, e per lo stesso motivo: le implementazioni pronte
 * (Swipeable di gesture-handler) hanno resa incerta su react-native-web, che qui è la
 * superficie di validazione (docs/HANDOFF.md §7). Gesture.Pan + Reanimated rispondono sia
 * al dito sia al mouse, e `withTiming` evita le molle che sul web restano a metà corsa.
 *
 * Lo swipe **non elimina**: scopre un pulsante. Chi decide è il tap sul pulsante, che apre
 * la conferma. Un gesto non è scopribile da chi usa uno screen reader, quindi la stessa
 * azione deve esistere anche altrove (qui: nella testata del dettaglio itinerario).
 */
import { Trash2 } from 'lucide-react-native';
import { useCallback, useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';
import { duration, radius, spacing } from '../theme/tokens';
import { Text } from './Text';

/** Larghezza dell'area scoperta: tap target pieno più respiro per l'etichetta. */
const ACTION_WIDTH = 96;
/** Oltre questa frazione la riga resta aperta al rilascio, sotto torna chiusa. */
const OPEN_THRESHOLD = ACTION_WIDTH / 2;

export type SwipeableRowProps = {
  children: ReactNode;
  /** Etichetta dell'azione: visibile e usata come nome accessibile. */
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
};

export function SwipeableRow({ children, actionLabel, onAction, disabled = false }: SwipeableRowProps) {
  const { colors } = useTheme();
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  const close = useCallback(() => {
    translateX.value = withTiming(0, { duration: duration.fast });
  }, [translateX]);

  const trigger = useCallback(() => {
    close();
    onAction();
  }, [close, onAction]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        // Si attiva solo su spostamento orizzontale: lo scorrimento verticale della lista
        // resta della lista.
        .activeOffsetX([-12, 12])
        .failOffsetY([-16, 16])
        .onStart(() => {
          startX.value = translateX.value;
        })
        .onUpdate((event) => {
          const next = startX.value + event.translationX;
          // Solo verso sinistra, e non oltre l'area dell'azione.
          translateX.value = Math.min(0, Math.max(-ACTION_WIDTH, next));
        })
        .onEnd(() => {
          const shouldOpen = translateX.value < -OPEN_THRESHOLD;
          translateX.value = withTiming(shouldOpen ? -ACTION_WIDTH : 0, {
            duration: duration.fast,
          });
        }),
    [disabled, startX, translateX]
  );

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  // L'azione compare man mano che si scopre: senza, il rosso apparirebbe di colpo.
  const actionStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(translateX.value) / OPEN_THRESHOLD),
  }));

  if (disabled) return <>{children}</>;

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.actionLayer, actionStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={trigger}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: colors.danger },
            pressed && styles.actionPressed,
          ]}>
          <Trash2 color="#FFFFFF" size={20} />
          <Text variant="caption" colorValue="#FFFFFF" numberOfLines={1}>
            {actionLabel}
          </Text>
        </Pressable>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  // `overflow: hidden` tiene l'azione dentro gli angoli arrotondati della card.
  root: { borderRadius: radius.lg, overflow: 'hidden' },
  actionLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'flex-end',
  },
  action: {
    width: ACTION_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    cursor: 'pointer',
  },
  actionPressed: { opacity: 0.85 },
});
