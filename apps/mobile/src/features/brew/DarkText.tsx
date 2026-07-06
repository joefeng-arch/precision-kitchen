import { Text, type TextProps } from 'react-native';

import { fonts, fontSizes } from '@/lib/theme/tokens';

export type DarkTextVariant = 'labelCaps' | 'bodyMd' | 'bodyLg' | 'headlineMd';

// Plain <Text> with fully explicit inline styles, deliberately NOT going through
// the shared `Typography` component. Typography bakes `text-on-surface` (near-
// black, for the light theme) into every variant's className, and on this dark
// screen a `text-[#FBF8F2]` override className appended after it does NOT win —
// verified live: NativeWind resolves conflicting utility classes by the order
// they were first compiled into the app's stylesheet, not by position in the
// className string, so `text-on-surface` (used everywhere else first) wins
// regardless. Inline style has no such cascade ambiguity.
const variantStyle: Record<DarkTextVariant, object> = {
  labelCaps: {
    fontFamily: fonts.labelCaps,
    fontSize: fontSizes.labelCaps.fontSize,
    lineHeight: fontSizes.labelCaps.lineHeight,
    letterSpacing: fontSizes.labelCaps.letterSpacing,
    textTransform: 'uppercase',
  },
  bodyMd: { fontFamily: fonts.bodyMd, fontSize: fontSizes.bodyMd.fontSize, lineHeight: fontSizes.bodyMd.lineHeight },
  bodyLg: { fontFamily: fonts.bodyLg, fontSize: fontSizes.bodyLg.fontSize, lineHeight: fontSizes.bodyLg.lineHeight },
  headlineMd: {
    fontFamily: fonts.headlineMd,
    fontSize: fontSizes.headlineMd.fontSize,
    lineHeight: fontSizes.headlineMd.lineHeight,
  },
};

export interface DarkTextProps extends TextProps {
  variant?: DarkTextVariant;
  color?: string;
}

export function DarkText({ variant = 'bodyMd', color = '#FBF8F2', style, ...props }: DarkTextProps) {
  return <Text style={[variantStyle[variant], { color }, style]} {...props} />;
}
