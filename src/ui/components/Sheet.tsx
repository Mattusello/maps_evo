/**
 * Sheet — pannello che sale dal basso per i sotto-task (dettaglio tappa, orari, costo).
 *
 * Implementazione **nativa**: `@gorhom/bottom-sheet` (gesti, snap point, backdrop).
 * Sul web esiste `Sheet.web.tsx`: il modale di gorhom, con Reanimated 4 su
 * react-native-web, viene montato ma non compare (present() non produce nulla), e questo
 * progetto si valida sul web (docs/HANDOFF.md §7). Stessa API, due implementazioni:
 * le schermate non sanno quale stanno usando.
 */
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme/tokens';

export type SheetProps = {
  open: boolean;
  onDismiss: () => void;
  /** Altezze di aggancio (solo nativo). */
  snapPoints?: string[];
  children: ReactNode;
};

const DEFAULT_SNAP_POINTS = ['60%', '92%'];

export function Sheet({ open, onDismiss, snapPoints, children }: SheetProps) {
  const { colors } = useTheme();
  const ref = useRef<BottomSheetModal>(null);
  const points = useMemo(() => snapPoints ?? DEFAULT_SNAP_POINTS, [snapPoints]);

  useEffect(() => {
    if (open) ref.current?.present();
    else ref.current?.dismiss();
  }, [open]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.4} />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={points}
      enablePanDownToClose
      onDismiss={onDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['4xl'] },
});
