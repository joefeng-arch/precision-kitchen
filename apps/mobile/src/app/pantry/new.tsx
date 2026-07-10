import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen, Typography } from '@/components/ui';
import { PantryItemForm } from '@/features/pantry/PantryItemForm';
import { useCreatePantryItem } from '@/lib/api/hooks/useCreatePantryItem';
import { colors } from '@/lib/theme/tokens';

export default function NewPantryItemRoute() {
  const insets = useSafeAreaInsets();
  const create = useCreatePantryItem();

  return (
    <Screen>
      <View
        className="flex-row items-center gap-3 px-5"
        style={{ paddingTop: insets.top + 8, paddingBottom: 8 }}
      >
        <Pressable onPress={() => router.back()} className="flex-row items-center gap-2">
          <MaterialIcons name="arrow-back" size={20} color={colors['on-surface-variant']} />
          <Typography variant="labelCaps" className="text-on-surface-variant">
            BACK
          </Typography>
        </Pressable>
        <Typography variant="headlineMd">Add ingredient</Typography>
      </View>
      <PantryItemForm
        submitLabel="Add to pantry"
        submitting={create.isPending}
        submitError={create.error ?? undefined}
        onSubmit={(body) => create.mutate(body, { onSuccess: () => router.back() })}
      />
    </Screen>
  );
}
