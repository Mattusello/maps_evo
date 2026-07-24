/**
 * Text: tipografia per ruoli. Applica variante (title1, body, caption…) e colore semantico.
 * Rispetta Dynamic Type/font scaling di sistema (non disabilita allowFontScaling).
 */
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { tabularNums, type TypographyVariant } from '../theme/tokens';
import type { SemanticColors } from '../theme/palette';

export type TextColor = keyof Pick<
  SemanticColors,
  | 'text'
  | 'textSecondary'
  | 'textTertiary'
  | 'primary'
  | 'onPrimary'
  | 'onPrimaryContainer'
  | 'success'
  | 'warning'
  | 'danger'
>;

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: TextColor;
  /** Cifre tabellari allineate: per orari e importi. */
  tabular?: boolean;
  /** Colore arbitrario (es. colore categoria) che ha precedenza su `color`. */
  colorValue?: string;
};

export function Text({
  variant = 'body',
  color = 'text',
  tabular = false,
  colorValue,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  return (
    <RNText
      style={[
        theme.typography[variant],
        { color: colorValue ?? theme.colors[color] },
        tabular && tabularNums,
        style,
      ]}
      {...rest}
    />
  );
}
