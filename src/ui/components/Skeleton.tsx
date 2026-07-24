/**
 * Skeleton: placeholder di caricamento con pulsazione discreta (Reanimated).
 * Rispetta implicitamente Reduce Motion: se disattivate, resta a opacità fissa.
 */
import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

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
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
    });
    return () => {
      cancelled = true;
    };
  }, [opacity]);

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
