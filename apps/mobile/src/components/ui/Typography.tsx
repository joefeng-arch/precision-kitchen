import { Text, type TextProps } from 'react-native';

export type TypographyVariant =
  | 'displayLg'
  | 'headlineMd'
  | 'bodyLg'
  | 'bodyMd'
  | 'labelCaps'
  | 'measurementLg'
  | 'measurementSm';

export interface TypographyProps extends TextProps {
  variant?: TypographyVariant;
}

// Only one display size exists (28/36, "mobile" per the source design's own
// naming) — this app has no separate 32px desktop-only display size to alias.
const variantClassName: Record<TypographyVariant, string> = {
  displayLg: 'font-display-lg text-display-lg-mobile text-on-surface',
  headlineMd: 'font-headline-md text-headline-md text-on-surface',
  bodyLg: 'font-body-lg text-body-lg text-on-surface',
  bodyMd: 'font-body-md text-body-md text-on-surface',
  labelCaps: 'font-label-caps text-label-caps text-on-surface',
  measurementLg: 'font-measurement-lg text-measurement-lg text-on-surface',
  measurementSm: 'font-measurement-sm text-measurement-sm text-on-surface',
};

export function Typography({ variant = 'bodyMd', className, ...props }: TypographyProps) {
  return (
    <Text className={`${variantClassName[variant]} ${className ?? ''}`} {...props} />
  );
}
