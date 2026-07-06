import { useLocalSearchParams } from 'expo-router';

import { Screen, Typography } from '@/components/ui';
import { BrewScreen } from '@/features/brew/BrewScreen';
import { ApiClientError } from '@/lib/api/errors';
import { useRecipe } from '@/lib/api/hooks/useRecipe';

export default function BrewSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: recipe, isLoading, error } = useRecipe(id);

  if (isLoading) {
    return (
      <Screen>
        <Typography variant="bodyMd" className="p-6">
          Loading...
        </Typography>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <Typography variant="bodyMd" className="p-6 text-error">
          {error instanceof ApiClientError ? error.message : String(error)}
        </Typography>
      </Screen>
    );
  }

  if (!recipe) return null;

  return <BrewScreen recipeId={recipe.id} title={recipe.title} steps={recipe.steps} />;
}
