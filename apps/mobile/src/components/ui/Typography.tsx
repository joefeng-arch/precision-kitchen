import { Text, type TextProps } from 'react-native';

export type TypographyVariant = 'display' | 'body' | 'mono';

export interface TypographyProps extends TextProps {
  variant?: TypographyVariant;
}

const variantClassName: Record<TypographyVariant, string> = {
  display: 'font-display text-ink',
  body: 'font-body text-ink',
  mono: 'font-mono text-ink',
};

export function Typography({ variant = 'body', className, ...props }: TypographyProps) {
  return (
    <Text className={`${variantClassName[variant]} ${className ?? ''}`} {...props} />
  );
}
