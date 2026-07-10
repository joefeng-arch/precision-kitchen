import { router } from 'expo-router';
import { Pressable, SectionList, Text, View } from 'react-native';

import { Button, Screen, Typography } from '@/components/ui';
import { ApiClientError } from '@/lib/api/errors';
import { useIngredientCategories } from '@/lib/api/hooks/useIngredientCategories';
import { usePantryList } from '@/lib/api/hooks/usePantryList';
import type { UserIngredientView } from '@/lib/api/types';
import { colors, fonts, fontSizes } from '@/lib/theme/tokens';

import { groupPantryItems, isDepleted } from './groupPantryItems';

/** 展示名：自定义名优先（publicName 只在关联公共食材时有） */
export function displayName(item: UserIngredientView): string {
  return item.customName ?? item.publicName ?? '—';
}

/** "0.0040"/g → "0.004 / g"（Number 去尾零；原料库不带货币符号——单价币种跟随部署，成本卡才有权威 currency） */
function priceLabel(item: UserIngredientView): string {
  return `${Number(item.unitPrice)} / ${item.priceUnit}`;
}

function DepletedBadge() {
  // plain Text + inline style：颜色覆写不走 Typography className（NativeWind 编译序陷阱）
  return (
    <View className="rounded-sm border border-outline-variant px-2 py-0.5">
      <Text
        style={{
          fontFamily: fonts.labelCaps,
          fontSize: fontSizes.labelCaps.fontSize,
          lineHeight: fontSizes.labelCaps.lineHeight,
          letterSpacing: fontSizes.labelCaps.letterSpacing,
          textTransform: 'uppercase',
          color: colors.error,
        }}
      >
        Depleted
      </Text>
    </View>
  );
}

function PantryRow({ item }: { item: UserIngredientView }) {
  return (
    <View className="flex-row items-center gap-3 border-b border-surface-variant/40 py-3">
      <View className="flex-1 flex-row items-center gap-2">
        <Typography variant="bodyLg">{displayName(item)}</Typography>
        {isDepleted(item) && <DepletedBadge />}
      </View>
      <View className="items-end">
        <Typography variant="measurementSm">{priceLabel(item)}</Typography>
        {item.stockAmount != null && !isDepleted(item) && (
          <Typography variant="bodyMd" className="text-on-surface-variant">
            {Number(item.stockAmount)} {item.stockUnit ?? ''}
          </Typography>
        )}
      </View>
    </View>
  );
}

export function PantryScreen() {
  const pantry = usePantryList();
  const categories = useIngredientCategories();

  const sections = groupPantryItems(pantry.data ?? [], categories.data ?? []);
  const error = pantry.error ?? categories.error;

  return (
    <Screen>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 20 }}
        stickySectionHeadersEnabled={false}
        refreshing={pantry.isRefetching}
        onRefresh={() => pantry.refetch()}
        ListHeaderComponent={
          <View className="mb-4 flex-row items-center justify-between">
            <Typography variant="headlineMd">Pantry</Typography>
            <Button
              variant="secondary"
              label="Add ingredient"
              onPress={() => router.push('/pantry/new')}
            />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Typography variant="labelCaps" className="mb-1 mt-5 text-on-surface-variant">
            {section.title}
          </Typography>
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({ pathname: '/pantry/[id]', params: { id: String(item.id) } })
            }
          >
            <PantryRow item={item} />
          </Pressable>
        )}
        ListEmptyComponent={
          pantry.isLoading ? (
            <Typography variant="bodyMd">Loading...</Typography>
          ) : error ? (
            <Typography variant="bodyMd" className="text-error">
              {error instanceof ApiClientError ? error.message : String(error)}
            </Typography>
          ) : (
            <View className="gap-2">
              <Typography variant="bodyLg">Your pantry is empty.</Typography>
              <Typography variant="bodyMd" className="text-on-surface-variant">
                Add ingredients with their prices to see what each recipe costs.
              </Typography>
            </View>
          )
        }
      />
    </Screen>
  );
}
