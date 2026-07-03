import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { View } from 'react-native';

import { Chip, Typography, type ChipTone } from '@/components/ui';
import { groupIngredients } from '@/features/recipes/groupIngredients';
import { colors } from '@/lib/theme/tokens';
import type { RecipeIngredient } from '@/lib/api/types';

export interface ScaledIngredientListProps {
  ingredients: RecipeIngredient[];
  /** id -> scaledAmount from the latest result; null = no result yet (show originals only). */
  scaledById: Map<number, number> | null;
  badgeById?: Map<number, { label: string; tone: ChipTone }>;
  isPending?: boolean;
}

export function ScaledIngredientList({
  ingredients,
  scaledById,
  badgeById,
  isPending,
}: ScaledIngredientListProps) {
  const groups = groupIngredients(ingredients);

  return (
    <View className="rounded-lg border border-surface-variant/60 bg-surface-container-lowest p-4">
      {groups.map(([groupName, items]) => (
        <View key={groupName ?? '_ungrouped'}>
          {groupName && (
            <Typography variant="labelCaps" className="mb-2 mt-3 text-on-surface-variant first:mt-0">
              {groupName}
            </Typography>
          )}
          {items.map((ing, i) => {
            const badge = badgeById?.get(ing.id);
            const scaled = scaledById?.get(ing.id);
            const showDimmed = scaled == null || isPending;
            const displayValue = scaled ?? Number(ing.amount);
            return (
              <View
                key={ing.id}
                className={`flex-row items-center gap-3 py-2 ${
                  i < items.length - 1 ? 'border-b border-surface-variant/40' : ''
                }`}
              >
                <View className="flex-1 flex-row items-center gap-2">
                  <Typography variant="bodyLg">{ing.name}</Typography>
                  {badge && (
                    <Chip label={badge.label} tone={badge.tone} shape="rounded" textVariant="labelCaps" />
                  )}
                </View>
                <Typography variant="measurementSm" className="text-on-surface-variant">
                  {Number(ing.amount)} {ing.unit}
                </Typography>
                <MaterialIcons name="arrow-forward" size={14} color={colors['on-surface-variant']} />
                <Typography
                  variant="measurementLg"
                  className={showDimmed ? 'opacity-50' : undefined}
                >
                  {displayValue} {ing.unit}
                </Typography>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
