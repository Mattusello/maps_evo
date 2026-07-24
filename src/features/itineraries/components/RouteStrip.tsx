/**
 * RouteStrip: l'elemento-firma del mondo "Segnaletica". Una linea-percorso verticale con
 * fermate (dot), come la legenda di una rete di trasporti. Rappresenta le tappe in colonna.
 */
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/ui/theme';

export function RouteStrip({
  count,
  color,
  max = 4,
}: {
  count: number;
  color?: string;
  max?: number;
}) {
  const { colors } = useTheme();
  const line = color ?? colors.primary;
  const dots = Math.max(1, Math.min(count, max));

  return (
    <View style={styles.root} accessibilityElementsHidden importantForAccessibility="no">
      <View style={[styles.line, { backgroundColor: line }]} />
      {Array.from({ length: dots }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              borderColor: line,
              backgroundColor: i === 0 ? line : colors.surface,
            },
          ]}
        />
      ))}
    </View>
  );
}

const DOT = 12;
const styles = StyleSheet.create({
  root: {
    width: DOT,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  line: {
    position: 'absolute',
    top: DOT / 2,
    bottom: DOT / 2,
    width: 2,
    borderRadius: 1,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
  },
});
