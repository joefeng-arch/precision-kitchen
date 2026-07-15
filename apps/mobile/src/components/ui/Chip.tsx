import { Text, View } from 'react-native';

import { colors, fonts, fontSizes } from '@/lib/theme/tokens';

import type { TypographyVariant } from './Typography';

export type ChipTone = 'surfaceContainer' | 'tertiarySoft';
export type ChipShape = 'pill' | 'rounded';

export interface ChipProps {
  label: string;
  tone?: ChipTone;
  shape?: ChipShape;
  textVariant?: TypographyVariant;
  className?: string;
  /** 限制行数并尾部省略（长标签在窄屏溢出 chip 容器时用——RN 原生不裁剪溢出） */
  numberOfLines?: number;
}

const toneContainerClassName: Record<ChipTone, string> = {
  surfaceContainer: 'bg-surface-container',
  tertiarySoft: 'bg-tertiary-soft-bg',
};

const toneTextColor: Record<ChipTone, string> = {
  surfaceContainer: colors['on-surface-variant'],
  tertiarySoft: colors.tertiary,
};

const shapeClassName: Record<ChipShape, string> = {
  pill: 'rounded-pill',
  rounded: 'rounded-sm',
};

/**
 * Plain <Text> with inline styles — NOT Typography's className path. Typography
 * bakes `text-on-surface` into every variant, and NativeWind resolves conflicting
 * classes by stylesheet compile order, not string position, so the appended tone
 * color class only wins by luck of the current compile order (same trap as
 * Button.tsx's label and features/brew/DarkText.tsx). Inline style has no such
 * cascade ambiguity.
 */
const textVariantStyle: Record<TypographyVariant, object> = {
  displayLg: {
    fontFamily: fonts.displayLg,
    fontSize: fontSizes.displayLgMobile.fontSize,
    lineHeight: fontSizes.displayLgMobile.lineHeight,
  },
  headlineMd: {
    fontFamily: fonts.headlineMd,
    fontSize: fontSizes.headlineMd.fontSize,
    lineHeight: fontSizes.headlineMd.lineHeight,
  },
  bodyLg: {
    fontFamily: fonts.bodyLg,
    fontSize: fontSizes.bodyLg.fontSize,
    lineHeight: fontSizes.bodyLg.lineHeight,
  },
  bodyMd: {
    fontFamily: fonts.bodyMd,
    fontSize: fontSizes.bodyMd.fontSize,
    lineHeight: fontSizes.bodyMd.lineHeight,
  },
  labelCaps: {
    fontFamily: fonts.labelCaps,
    fontSize: fontSizes.labelCaps.fontSize,
    lineHeight: fontSizes.labelCaps.lineHeight,
    letterSpacing: fontSizes.labelCaps.letterSpacing,
    textTransform: 'uppercase',
  },
  measurementLg: {
    fontFamily: fonts.measurementLg,
    fontSize: fontSizes.measurementLg.fontSize,
    lineHeight: fontSizes.measurementLg.lineHeight,
  },
  measurementSm: {
    fontFamily: fonts.measurementSm,
    fontSize: fontSizes.measurementSm.fontSize,
    lineHeight: fontSizes.measurementSm.lineHeight,
  },
};

export function Chip({
  label,
  tone = 'surfaceContainer',
  shape = 'pill',
  textVariant = 'labelCaps',
  className,
  numberOfLines,
}: ChipProps) {
  return (
    <View
      className={`px-2 py-1 ${toneContainerClassName[tone]} ${shapeClassName[shape]} ${className ?? ''}`}
    >
      <Text
        style={[textVariantStyle[textVariant], { color: toneTextColor[tone] }]}
        numberOfLines={numberOfLines}
        ellipsizeMode={numberOfLines != null ? 'tail' : undefined}
      >
        {label}
      </Text>
    </View>
  );
}
