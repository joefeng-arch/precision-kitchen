import { View } from 'react-native';

import { Typography, type TypographyVariant } from './Typography';

export type ChipTone = 'surfaceContainer' | 'tertiarySoft';
export type ChipShape = 'pill' | 'rounded';

export interface ChipProps {
  label: string;
  tone?: ChipTone;
  shape?: ChipShape;
  textVariant?: TypographyVariant;
  className?: string;
}

const toneContainerClassName: Record<ChipTone, string> = {
  surfaceContainer: 'bg-surface-container',
  tertiarySoft: 'bg-tertiary-soft-bg',
};

const toneTextClassName: Record<ChipTone, string> = {
  surfaceContainer: 'text-on-surface-variant',
  tertiarySoft: 'text-tertiary',
};

const shapeClassName: Record<ChipShape, string> = {
  pill: 'rounded-pill',
  rounded: 'rounded-sm',
};

export function Chip({
  label,
  tone = 'surfaceContainer',
  shape = 'pill',
  textVariant = 'labelCaps',
  className,
}: ChipProps) {
  return (
    <View
      className={`px-2 py-1 ${toneContainerClassName[tone]} ${shapeClassName[shape]} ${className ?? ''}`}
    >
      <Typography variant={textVariant} className={toneTextClassName[tone]}>
        {label}
      </Typography>
    </View>
  );
}
