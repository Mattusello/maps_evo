/**
 * DraggableList — lista riordinabile per trascinamento.
 *
 * Perché fatta in casa e non con una libreria: le librerie di drag&drop per RN sono
 * costruite su FlatList e sui gesti nativi, e sul web (dove questo progetto viene validato,
 * vedi docs/HANDOFF.md §7) hanno una resa incerta. Qui bastano poche decine di righe:
 * gli elementi hanno **altezza fissa**, sono posizionati in assoluto e ogni riga anima il
 * proprio `top` quando l'indice cambia. Gesture-handler + Reanimated funzionano sia con il
 * dito sia con il mouse.
 *
 * Il trascinamento parte dalla **maniglia** (`handle` passato a `renderItem`), non da tutta
 * la riga: così il tap sulla riga resta libero di aprire il dettaglio.
 * Il riordino è confermato al rilascio con l'ordine completo delle chiavi.
 */
import { GripVertical } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, type PanGesture } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';
import { duration, minTapTarget, radius } from '../theme/tokens';

/** Mappa chiave → indice corrente. Vive in una shared value: la muove il gesto. */
type Positions = Record<string, number>;

export type DraggableListRenderArgs<T> = {
  item: T;
  index: number;
  /** true mentre la riga è trascinata: utile per alzarla visivamente. */
  isActive: boolean;
  /** Maniglia da posizionare dentro la riga: è l'unica zona che avvia il trascinamento. */
  handle: ReactNode;
};

export type DraggableListProps<T> = {
  data: T[];
  keyExtractor: (item: T) => string;
  /** Altezza fissa di ogni riga: serve al calcolo degli indici durante il trascinamento. */
  itemHeight: number;
  /** Spazio verticale fra le righe. */
  gap?: number;
  renderItem: (args: DraggableListRenderArgs<T>) => ReactNode;
  /** Chiamato al rilascio con il nuovo ordine completo delle chiavi. */
  onReorder: (orderedKeys: string[]) => void;
  /** Disattiva il trascinamento (es. lista di un solo elemento). */
  disabled?: boolean;
  /** Etichetta accessibile della maniglia. */
  handleLabel?: string;
};

const clamp = (value: number, min: number, max: number) => {
  'worklet';
  return Math.min(Math.max(value, min), max);
};

/** Scambia la posizione di `key` con quella dell'elemento attualmente a `toIndex`. */
function swap(positions: Positions, key: string, toIndex: number): Positions {
  'worklet';
  const fromIndex = positions[key];
  const next: Positions = { ...positions };
  for (const k of Object.keys(next)) {
    if (next[k] === toIndex) next[k] = fromIndex;
  }
  next[key] = toIndex;
  return next;
}

export function DraggableList<T>({
  data,
  keyExtractor,
  itemHeight,
  gap = 0,
  renderItem,
  onReorder,
  disabled = false,
  handleLabel,
}: DraggableListProps<T>) {
  const stride = itemHeight + gap;
  const keys = useMemo(() => data.map(keyExtractor), [data, keyExtractor]);
  const keysSignature = keys.join('|');

  const positions = useSharedValue<Positions>(Object.fromEntries(keys.map((k, i) => [k, i])));

  // I dati possono cambiare da fuori (aggiunta/rimozione tappa, ottimizzazione percorso):
  // in quel caso le posizioni ripartono dall'ordine ricevuto. La dipendenza è la firma
  // delle chiavi, non l'array: evita di risincronizzare a ogni render.
  useEffect(() => {
    positions.value = Object.fromEntries(keys.map((k, i) => [k, i]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysSignature]);

  const commit = useCallback(() => {
    const current = positions.value;
    const ordered = [...Object.keys(current)].sort((a, b) => current[a] - current[b]);
    if (ordered.some((k, i) => k !== keys[i])) onReorder(ordered);
  }, [positions, keys, onReorder]);

  return (
    <View style={{ height: Math.max(0, data.length * stride - gap) }}>
      {data.map((item, index) => {
        const key = keyExtractor(item);
        return (
          <DraggableRow
            key={key}
            itemKey={key}
            initialIndex={index}
            positions={positions}
            stride={stride}
            itemHeight={itemHeight}
            count={data.length}
            disabled={disabled || data.length < 2}
            handleLabel={handleLabel}
            onCommit={commit}
          >
            {(isActive, handle) => renderItem({ item, index, isActive, handle })}
          </DraggableRow>
        );
      })}
    </View>
  );
}

type RowProps = {
  itemKey: string;
  /** Posizione di partenza: evita di leggere la shared value durante il render. */
  initialIndex: number;
  positions: SharedValue<Positions>;
  stride: number;
  itemHeight: number;
  count: number;
  disabled: boolean;
  handleLabel?: string;
  onCommit: () => void;
  children: (isActive: boolean, handle: ReactNode) => ReactNode;
};

function DraggableRow({
  itemKey,
  initialIndex,
  positions,
  stride,
  itemHeight,
  count,
  disabled,
  handleLabel,
  onCommit,
  children,
}: RowProps) {
  const top = useSharedValue(initialIndex * stride);
  const dragging = useSharedValue(false);
  const startTop = useSharedValue(0);
  const [isActive, setIsActive] = useState(false);

  // Quando un'altra riga viene trascinata sopra questa, questa scivola al nuovo posto.
  useAnimatedReaction(
    () => positions.value[itemKey],
    (index, previous) => {
      if (index === undefined || index === previous) return;
      if (!dragging.value) top.value = withTiming(index * stride, { duration: duration.base });
    },
    [stride]
  );

  // Rete di sicurezza: la posizione di riposo la decide React (l'ordine ricevuto dai dati).
  // Se un'animazione viene interrotta a metà — capita sul web — la riga si riallinea comunque.
  useEffect(() => {
    if (dragging.value) return;
    top.value = withTiming(initialIndex * stride, { duration: duration.base });
  }, [initialIndex, stride, top, dragging]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .onStart(() => {
          dragging.value = true;
          startTop.value = top.value;
          runOnJS(setIsActive)(true);
        })
        .onUpdate((event) => {
          top.value = startTop.value + event.translationY;
          const nextIndex = clamp(Math.round(top.value / stride), 0, count - 1);
          if (nextIndex !== positions.value[itemKey]) {
            positions.value = swap(positions.value, itemKey, nextIndex);
          }
        })
        .onEnd(() => {
          top.value = withTiming((positions.value[itemKey] ?? 0) * stride, {
            duration: duration.fast,
          });
        })
        .onFinalize(() => {
          dragging.value = false;
          runOnJS(setIsActive)(false);
          runOnJS(onCommit)();
        }),
    [disabled, count, stride, itemKey, positions, top, startTop, dragging, onCommit]
  );

  const style = useAnimatedStyle(() => ({
    top: top.value,
    zIndex: dragging.value ? 2 : 1,
    transform: [{ scale: withTiming(dragging.value ? 1.02 : 1, { duration: duration.fast }) }],
  }));

  return (
    <Animated.View style={[styles.row, { height: itemHeight }, style]}>
      {children(isActive, <DragHandle gesture={pan} label={handleLabel} disabled={disabled} />)}
    </Animated.View>
  );
}

/** Maniglia di trascinamento: zona sensibile ≥ 44pt, con affordance a grip. */
function DragHandle({
  gesture,
  label,
  disabled,
}: {
  gesture: PanGesture;
  label?: string;
  disabled: boolean;
}) {
  const { colors } = useTheme();
  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        style={[styles.handle, disabled && styles.handleDisabled]}
      >
        <GripVertical color={colors.textTertiary} size={20} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  // `box-none` nello style (non come prop, deprecata): la riga non intercetta i tocchi,
  // li ricevono i figli (la card premibile e la maniglia).
  row: { position: 'absolute', left: 0, right: 0, pointerEvents: 'box-none' },
  handle: {
    width: minTapTarget,
    minHeight: minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    // `cursor` è ignorato su nativo; sul web segnala che l'elemento è manipolabile.
    cursor: 'pointer',
  },
  handleDisabled: { opacity: 0, cursor: 'auto' },
});
