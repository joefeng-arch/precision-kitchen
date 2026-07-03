import { Typography } from '@/components/ui';
import type { RecipeDetail } from '@/lib/api/types';

import { BakersPercentageControls } from './BakersPercentageControls';
import { MultiRatioControls } from './MultiRatioControls';
import { RatioBasedControls } from './RatioBasedControls';
import { ServingsRuler } from './ServingsRuler';

export function ScalingWorkbench({ recipe }: { recipe: RecipeDetail }) {
  switch (recipe.scalingProfile) {
    case 'linear_legacy':
      return <ServingsRuler recipe={recipe} />;
    case 'bakers_percentage':
      return <BakersPercentageControls recipe={recipe} />;
    case 'ratio_based':
      return <RatioBasedControls recipe={recipe} />;
    case 'multi_ratio':
      return <MultiRatioControls recipe={recipe} />;
    default:
      return (
        <Typography variant="bodyMd" className="text-error">
          Unknown scaling profile.
        </Typography>
      );
  }
}
