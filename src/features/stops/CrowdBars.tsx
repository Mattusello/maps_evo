/**
 * CrowdBars: mini-istogramma dell'affollamento stimato nell'arco della giornata (24 ore),
 * con l'ora corrente evidenziata. Il dato è sempre "stimato" (vedi CrowdProvider).
 */
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/ui/theme';

export function CrowdBars({ curve, currentHour }: { curve: number[]; currentHour: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityLabel="Affollamento stimato per ora">
      {curve.map((v, h) => {
        const isNow = h === currentHour;
        return (
          <View key={h} style={styles.col}>
            <View style={styles.track}>
              <View
                style={[
                  styles.bar,
                  {
                    height: `${Math.max(6, v * 100)}%`,
                    backgroundColor: isNow ? colors.primary : colors.primaryContainer,
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 44 },
  col: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  track: { height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 2, minHeight: 3 },
});
