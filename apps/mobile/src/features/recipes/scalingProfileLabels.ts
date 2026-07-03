import type { ScalingProfile } from '@/lib/api/types';

// No mockup example exists for linear_legacy — "Servings" is the sensible placeholder.
export const scalingProfileLabels: Record<ScalingProfile, string> = {
  bakers_percentage: "Baker's %",
  ratio_based: 'Ratio',
  multi_ratio: 'Multi-ratio',
  linear_legacy: 'Servings',
};
