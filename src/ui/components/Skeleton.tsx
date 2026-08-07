/**
 * Skeleton: placeholder di caricamento con pulsazione discreta (Reanimated).
 * Rispetta implicitamente Reduce Motion: se disattivate, resta a opacità fissa.
 */
import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import { radius as radiusTokens } from '../theme/tokens';

export function Skeleton({
  width = '100%',
  height = 16,
  radius = 'sm',
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: keyof typeof radiusTokens;
}) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity, reducedMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radiusTokens[radius], backgroundColor: colors.surfaceMuted },
        style,
      ]}
    />
  );
}
