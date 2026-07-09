import { Pressable, View } from 'react-native';

import { Typography } from '@/components/ui';
import type { ParsedIngredient } from '@/lib/api/types';

export interface IngredientRowProps {
  ingredient: ParsedIngredient;
  onDelete: () => void;
}

export function IngredientRow({ ingredient, onDelete }: IngredientRowProps) {
  const { name, amount, unit, groupName } = ingredient;
  return (
    <View className="flex-row items-center justify-between gap-3">
      <View className="flex-1">
        <Typography variant="bodyLg">{name}</Typography>
        <Typography variant="measurementSm" className="text-on-surface-variant">
          {amount > 0 ? `${amount} ${unit}` : unit}
          {groupName ? ` · ${groupName}` : ''}
        </Typography>
      </View>
      <Pressable accessibilityLabel={`Remove ${name}`} hitSlop={8} onPress={onDelete}>
        <Typography variant="bodyLg" className="text-on-surface-variant">
          ✕
        </Typography>
      </Pressable>
    </View>
  );
}
