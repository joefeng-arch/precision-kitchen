// Color keys are kebab-case string literals (not camelCase) because Tailwind
// generates utility classes directly from these key strings, e.g.
// `colors['surface-container-lowest']` -> `bg-surface-container-lowest`.
export const colors = {
  surface: '#fcf9f3',
  'surface-dim': '#dcdad4',
  'surface-container-lowest': '#ffffff',
  'surface-container-low': '#f6f3ed',
  'surface-container': '#f0eee8',
  'surface-container-high': '#ebe8e2',
  'surface-container-highest': '#e5e2dc',
  'surface-variant': '#e5e2dc',
  'on-surface': '#1c1c18',
  'on-surface-variant': '#544437',
  'on-background': '#1c1c18',
  background: '#fcf9f3',
  outline: '#877365',
  'outline-variant': '#dac2b1',
  primary: '#8f4e00',
  'on-primary': '#ffffff',
  'primary-container': '#d9822b',
  'on-primary-container': '#4b2600',
  secondary: '#466729',
  'on-secondary': '#ffffff',
  'secondary-container': '#c6efa1',
  'on-secondary-container': '#4c6e2f',
  tertiary: '#8a4b5e',
  'tertiary-container': '#cb8296',
  // precomputed 10%-opacity tertiary bg — NativeWind's opacity shorthand on custom
  // colors is unreliable, so the rgba value is baked in as its own token
  'tertiary-soft-bg': 'rgba(138,75,94,0.1)',
  error: '#ba1a1a',
  'on-error': '#ffffff',
  // card border + doodle-divider stroke; both hardcode this exact hex in the source mockup
  'card-border': '#EAE3D5',
} as const;

export const fonts = {
  displayLg: 'PlusJakartaSans_700Bold',
  headlineMd: 'PlusJakartaSans_600SemiBold',
  bodyLg: 'PlusJakartaSans_400Regular',
  bodyMd: 'PlusJakartaSans_400Regular',
  labelCaps: 'PlusJakartaSans_700Bold',
  measurementLg: 'JetBrainsMono_500Medium',
  measurementSm: 'JetBrainsMono_400Regular',
} as const;

export const fontSizes = {
  displayLgMobile: { fontSize: 28, lineHeight: 36 },
  headlineMd: { fontSize: 24, lineHeight: 32 },
  bodyLg: { fontSize: 18, lineHeight: 28 },
  bodyMd: { fontSize: 16, lineHeight: 24 },
  labelCaps: { fontSize: 12, lineHeight: 16, letterSpacing: 0.6 },
  measurementLg: { fontSize: 20, lineHeight: 24 },
  measurementSm: { fontSize: 14, lineHeight: 20 },
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 9999,
} as const;

export const shadows = {
  card: {
    shadowColor: '#5D4037',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
} as const;
