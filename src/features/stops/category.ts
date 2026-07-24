/**
 * Helper categoria: colore-linea (dai token) ed etichetta i18n.
 */
import type { TFunction } from 'i18next';

import type { StopCategory } from '@/core/models';
import { categoryColors } from '@/ui/theme';

export function categoryColor(category: StopCategory): string {
  if (category === 'altro') return categoryColors.trasporto;
  return categoryColors[category];
}

export function categoryLabel(t: TFunction, category: StopCategory): string {
  return t(`category.${category}`);
}
