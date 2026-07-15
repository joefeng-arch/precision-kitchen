import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { AvatarInitials, Chip, Typography } from '@/components/ui';
import { resolveImageUrl } from '@/lib/api/resolveImageUrl';
import { shadows } from '@/lib/theme/tokens';
import type { RecipeListItem } from '@/lib/api/types';

import { scalingProfileLabels } from '../scalingProfileLabels';

export interface RecipeCardProps {
  recipe: RecipeListItem;
  onPress: () => void;
}

export function RecipeCard({ recipe, onPress }: RecipeCardProps) {
  const imageUri = resolveImageUrl(recipe.coverImage);
  const category = recipe.categories[0]?.name;

  return (
    <Pressable
      onPress={onPress}
      className="rounded-xl border border-card-border bg-surface-container-lowest p-4"
      style={shadows.card}
    >
      {/* 无图（导入配方常见）走紧凑纯文字卡，不留空块 */}
      {imageUri && (
        <View className="aspect-[4/5] overflow-hidden rounded-lg bg-surface-container-low">
          <Image
            source={{ uri: imageUri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        </View>
      )}

      <View className={`${imageUri ? 'mt-4' : ''} flex-row items-start justify-between gap-2`}>
        <Typography variant="headlineMd" className="flex-1">
          {recipe.title}
        </Typography>
        <Chip
          label={scalingProfileLabels[recipe.scalingProfile]}
          tone="surfaceContainer"
          shape="rounded"
          textVariant="measurementSm"
        />
      </View>

      <View className="mt-2 flex-row items-center gap-2">
        <AvatarInitials nickname={recipe.author?.nickname} id={recipe.author?.id} />
        <Typography variant="bodyMd" className="text-on-surface-variant">
          {recipe.author?.nickname ?? 'Unknown'}
        </Typography>
      </View>

      {category && (
        <View className="mt-2 flex-row">
          <Chip label={category} tone="tertiarySoft" shape="pill" className="uppercase" />
        </View>
      )}
    </Pressable>
  );
}
