/**
 * Helper categoria: colore-linea (dai token) ed etichetta i18n.
 *
 * Il colore dipende dal **tema attivo**, perché la stessa etichetta di categoria è testo
 * piccolo e deve restare leggibile sia su fondo chiaro sia su fondo scuro (vedi
 * `categoryPalettes` in `ui/theme/palette.ts`). Nei componenti si usa `useCategoryColor()`;
 * sopra la mappa si usa `mapCategoryColor`, perché lì il fondo è sempre la tile chiara.
 */
import type { TFunction } from 'i18next';

import type { StopCategory } from '@/core/models';
import { categoryPalettes, mapCategoryColors, useTheme, type ColorScheme } from '@/ui/theme';

/** `altro` non ha una linea propria: prende il grigio dei trasporti. */
function keyOf(category: StopCategory) {
  return category === 'altro' ? ('trasporto' as const) : category;
}

export function categoryColor(category: StopCategory, scheme: ColorScheme = 'light'): string {
  return categoryPalettes[scheme][keyOf(category)];
}

/** Colore della categoria sopra la mappa (tile chiare in entrambi i temi). */
export function mapCategoryColor(category: StopCategory): string {
  return mapCategoryColors[keyOf(category)];
}

/** Colore della categoria nel tema attivo. */
export function useCategoryColor(): (category: StopCategory) => string {
  const { scheme } = useTheme();
  return (category: StopCategory) => categoryColor(category, scheme);
}

export function categoryLabel(t: TFunction, category: StopCategory): string {
  return t(`category.${category}`);
}
