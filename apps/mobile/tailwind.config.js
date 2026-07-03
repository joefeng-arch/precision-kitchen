const { colors, fonts } = require('./src/lib/theme/tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/app/**/*.{js,jsx,ts,tsx}', './src/components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors,
      fontFamily: {
        display: [fonts.display],
        body: [fonts.body],
        mono: [fonts.mono],
      },
    },
  },
};
