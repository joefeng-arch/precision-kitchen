import type { ReactNode } from 'react';
import { Pressable, Text, type PressableProps } from 'react-native';

import { colors, fonts, fontSizes } from '@/lib/theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'cta';

export interface ButtonProps extends PressableProps {
  variant?: ButtonVariant;
  label: string;
  icon?: ReactNode;
}

const variantContainerClassName: Record<ButtonVariant, string> = {
  primary: 'bg-primary-container rounded-pill px-6 py-3',
  secondary: 'border border-outline-variant rounded-pill px-6 py-3',
  cta: 'bg-primary-container rounded-xl px-6 min-h-[64px]',
};

/**
 * Plain <Text> with inline styles — NOT Typography's className path. Typography
 * bakes `text-on-surface` into every variant, and NativeWind resolves conflicting
 * classes by first-compiled-in-the-app order, not string position, so an
 * appended `text-on-primary-container` override does not reliably win (verified
 * live: labels rendered on-surface's #1c1c18 instead of the intended
 * on-primary-container #4b2600). Same workaround as features/brew/DarkText.tsx.
 */
const variantLabelStyle: Record<
  ButtonVariant,
  { fontFamily: string; fontSize: number; lineHeight: number; color: string }
> = {
  primary: {
    fontFamily: fonts.bodyMd,
    fontSize: fontSizes.bodyMd.fontSize,
    lineHeight: fontSizes.bodyMd.lineHeight,
    color: colors['on-primary-container'],
  },
  secondary: {
    fontFamily: fonts.bodyMd,
    fontSize: fontSizes.bodyMd.fontSize,
    lineHeight: fontSizes.bodyMd.lineHeight,
    color: colors['on-surface'],
  },
  cta: {
    fontFamily: fonts.headlineMd,
    fontSize: fontSizes.headlineMd.fontSize,
    lineHeight: fontSizes.headlineMd.lineHeight,
    color: colors['on-primary-container'],
  },
};

export function Button({ variant = 'primary', label, icon, className, ...props }: ButtonProps) {
  return (
    <Pressable
      className={`flex-row items-center justify-center gap-2 ${variantContainerClassName[variant]} ${className ?? ''}`}
      {...props}
    >
      {icon}
      <Text style={variantLabelStyle[variant]}>{label}</Text>
    </Pressable>
  );
}
