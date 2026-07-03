import { Pressable, type PressableProps } from 'react-native';

import { Typography } from './Typography';

export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps extends PressableProps {
  variant?: ButtonVariant;
  label: string;
}

const variantClassName: Record<ButtonVariant, string> = {
  primary: 'bg-measure',
  secondary: 'border border-line',
};

const variantLabelClassName: Record<ButtonVariant, string> = {
  primary: 'text-paper',
  secondary: 'text-ink',
};

export function Button({ variant = 'primary', label, className, ...props }: ButtonProps) {
  return (
    <Pressable
      className={`items-center justify-center rounded-full px-6 py-3 ${variantClassName[variant]} ${className ?? ''}`}
      {...props}
    >
      <Typography variant="body" className={variantLabelClassName[variant]}>
        {label}
      </Typography>
    </Pressable>
  );
}
