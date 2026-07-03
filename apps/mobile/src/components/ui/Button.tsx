import type { ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';

import { Typography } from './Typography';

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

const variantLabelClassName: Record<ButtonVariant, string> = {
  primary: 'text-on-primary-container',
  secondary: 'text-on-surface',
  cta: 'text-on-primary-container',
};

const variantLabelVariant = {
  primary: 'bodyMd',
  secondary: 'bodyMd',
  cta: 'headlineMd',
} as const;

export function Button({ variant = 'primary', label, icon, className, ...props }: ButtonProps) {
  return (
    <Pressable
      className={`flex-row items-center justify-center gap-2 ${variantContainerClassName[variant]} ${className ?? ''}`}
      {...props}
    >
      {icon}
      <Typography variant={variantLabelVariant[variant]} className={variantLabelClassName[variant]}>
        {label}
      </Typography>
    </Pressable>
  );
}
