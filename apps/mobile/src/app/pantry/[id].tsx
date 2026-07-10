import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Screen, Typography } from '@/components/ui';
import { PantryItemForm } from '@/features/pantry/PantryItemForm';
import { isDepleted } from '@/features/pantry/groupPantryItems';
import { useDeletePantryItem } from '@/lib/api/hooks/useDeletePantryItem';
import { usePantryList } from '@/lib/api/hooks/usePantryList';
import { useUpdatePantryItem } from '@/lib/api/hooks/useUpdatePantryItem';
import { colors } from '@/lib/theme/tokens';

export default function EditPantryItemRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const pantry = usePantryList();
  const update = useUpdatePantryItem();
  const remove = useDeletePantryItem();

  const itemId = Number(id);
  const item = pantry.data?.find((i) => i.id === itemId);

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
        <Typography variant="headlineMd">Edit ingredient</Typography>
      </View>

      {!item ? (
        <Typography variant="bodyMd" className="p-6">
          {pantry.isLoading ? 'Loading...' : 'Ingredient not found.'}
        </Typography>
      ) : (
        <>
          <PantryItemForm
            initial={item}
            submitLabel="Save changes"
            submitting={update.isPending}
            submitError={update.error ?? undefined}
            onSubmit={(body) =>
              update.mutate({ id: item.id, body }, { onSuccess: () => router.back() })
            }
          />
          <View className="gap-3 px-5 pb-8">
            {!isDepleted(item) && (
              <Button
                label="Mark as depleted"
                variant="secondary"
                disabled={update.isPending}
                onPress={() => update.mutate({ id: item.id, body: { stockAmount: 0 } })}
              />
            )}
            <Button
              label={remove.isPending ? 'Removing...' : 'Remove from pantry'}
              variant="secondary"
              disabled={remove.isPending}
              onPress={() => remove.mutate(item.id, { onSuccess: () => router.back() })}
            />
          </View>
        </>
      )}
    </Screen>
  );
}
