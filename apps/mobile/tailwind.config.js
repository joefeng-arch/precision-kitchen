const { colors, fonts, fontSizes, radii } = require('./src/lib/theme/tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,jsx,ts,tsx}',
    './src/components/**/*.{js,jsx,ts,tsx}',
    './src/features/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors,
      fontFamily: {
        'display-lg': [fonts.displayLg],
        'headline-md': [fonts.headlineMd],
        'body-lg': [fonts.bodyLg],
        'body-md': [fonts.bodyMd],
        'label-caps': [fonts.labelCaps],
        'measurement-lg': [fonts.measurementLg],
        'measurement-sm': [fonts.measurementSm],
      },
      fontSize: {
        'display-lg-mobile': [
          `${fontSizes.displayLgMobile.fontSize}px`,
          { lineHeight: `${fontSizes.displayLgMobile.lineHeight}px` },
        ],
        'headline-md': [
          `${fontSizes.headlineMd.fontSize}px`,
          { lineHeight: `${fontSizes.headlineMd.lineHeight}px` },
        ],
        'body-lg': [
          `${fontSizes.bodyLg.fontSize}px`,
          { lineHeight: `${fontSizes.bodyLg.lineHeight}px` },
        ],
        'body-md': [
          `${fontSizes.bodyMd.fontSize}px`,
          { lineHeight: `${fontSizes.bodyMd.lineHeight}px` },
        ],
        'label-caps': [
          `${fontSizes.labelCaps.fontSize}px`,
          {
            lineHeight: `${fontSizes.labelCaps.lineHeight}px`,
            letterSpacing: `${fontSizes.labelCaps.letterSpacing}px`,
          },
        ],
        'measurement-lg': [
          `${fontSizes.measurementLg.fontSize}px`,
          { lineHeight: `${fontSizes.measurementLg.lineHeight}px` },
        ],
        'measurement-sm': [
          `${fontSizes.measurementSm.fontSize}px`,
          { lineHeight: `${fontSizes.measurementSm.lineHeight}px` },
        ],
      },
      borderRadius: {
        sm: `${radii.sm}px`,
        md: `${radii.md}px`,
        lg: `${radii.lg}px`,
        xl: `${radii.xl}px`,
        pill: `${radii.pill}px`,
      },
    },
  },
};
