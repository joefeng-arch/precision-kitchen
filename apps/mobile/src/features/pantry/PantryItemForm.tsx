import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Chip, Typography } from '@/components/ui';
import { ApiClientError } from '@/lib/api/errors';
import { useDebouncedValue } from '@/lib/api/hooks/useDebouncedValue';
import { useIngredientCategories } from '@/lib/api/hooks/useIngredientCategories';
import { useIngredientSuggestions } from '@/lib/api/hooks/useIngredientSuggestions';
import type { CreateUserIngredientRequest, UserIngredientView } from '@/lib/api/types';
import { colors } from '@/lib/theme/tokens';

import {
  buildPantryBody,
  emptyPantryForm,
  type PantryFormErrors,
  type PantryFormState,
} from './pantryForm';

const PRICE_UNITS = ['g', 'kg', 'ml', 'l', 'oz', 'lb', 'cup'];

const inputClassName =
  'rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 text-on-surface';
/** 校验失败字段的红框（录屏实测：只有文字报错时用户对不上是哪个框） */
const inputErrorClassName =
  'rounded-lg border border-error bg-surface-container-lowest px-4 py-3 text-on-surface';

function initialState(item?: UserIngredientView): PantryFormState {
  if (!item) return emptyPantryForm;
  return {
    ingredientId: item.ingredientId,
    name: item.customName ?? item.publicName ?? '',
    unitPrice: String(Number(item.unitPrice)), // "0.0040" → "0.004"
    priceUnit: item.priceUnit,
    stockAmount: item.stockAmount != null ? String(Number(item.stockAmount)) : '',
    stockUnit: item.stockUnit ?? '',
    categoryId: item.categoryId,
    notes: item.notes ?? '',
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Typography variant="bodyMd" className="text-error">
      {message}
    </Typography>
  );
}

export interface PantryItemFormProps {
  /** edit 模式传入现有条目做预填 */
  initial?: UserIngredientView;
  submitLabel: string;
  submitting: boolean;
  submitError?: unknown;
  onSubmit: (body: CreateUserIngredientRequest) => void;
}

/**
 * 新增/编辑共用表单。名称栏 = 公共库 autocomplete（选中锁定 ingredientId，可清除）
 * + 自由文本兜底（customName）；中文公共库对英文关键词常为空——预期行为。
 */
export function PantryItemForm({
  initial,
  submitLabel,
  submitting,
  submitError,
  onSubmit,
}: PantryItemFormProps) {
  const [form, setForm] = useState<PantryFormState>(() => initialState(initial));
  const [errors, setErrors] = useState<PantryFormErrors>({});

  const set = <K extends keyof PantryFormState>(key: K, value: PantryFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // 已锁定建议时不再搜索
  const keyword = useDebouncedValue(form.ingredientId == null ? form.name.trim() : '', 300);
  const suggestions = useIngredientSuggestions(keyword);
  const categories = useIngredientCategories();

  const handleSubmit = () => {
    const result = buildPantryBody(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSubmit(result.body);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
    <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled">
      {/* 名称 + autocomplete */}
      <View className="gap-2">
        <Typography variant="labelCaps" className="text-on-surface-variant">
          Ingredient
        </Typography>
        {form.ingredientId != null ? (
          <Pressable
            className="flex-row items-center gap-2 self-start rounded-pill bg-tertiary-soft-bg px-4 py-2"
            onPress={() => setForm((f) => ({ ...f, ingredientId: null }))}
          >
            <Typography variant="bodyLg">{form.name}</Typography>
            <MaterialIcons name="close" size={16} color={colors['on-surface-variant']} />
          </Pressable>
        ) : (
          <TextInput
            className={errors.name ? inputErrorClassName : inputClassName}
            placeholder="e.g. Bread flour"
            placeholderTextColor={colors['on-surface-variant']}
            value={form.name}
            onChangeText={(v) => set('name', v)}
          />
        )}
        {form.ingredientId == null && (suggestions.data?.length ?? 0) > 0 && (
          <View className="flex-row flex-wrap gap-2">
            {suggestions.data!.map((s) => (
              <Pressable
                key={s.id}
                onPress={() =>
                  setForm((f) => ({
                    ...f,
                    ingredientId: s.id,
                    name: s.name,
                    priceUnit: f.priceUnit || s.defaultUnit,
                  }))
                }
              >
                <Chip label={s.name} tone="surfaceContainer" />
              </Pressable>
            ))}
          </View>
        )}
        <FieldError message={errors.name} />
      </View>

      {/* 分类 */}
      <View className="gap-2">
        <Typography variant="labelCaps" className="text-on-surface-variant">
          Category
        </Typography>
        <View className="flex-row flex-wrap gap-2">
          {(categories.data ?? []).map((c) => (
            <Pressable
              key={c.id}
              onPress={() => set('categoryId', form.categoryId === c.id ? null : c.id)}
            >
              <Chip
                label={c.name}
                tone={form.categoryId === c.id ? 'tertiarySoft' : 'surfaceContainer'}
              />
            </Pressable>
          ))}
        </View>
      </View>

      {/* 单价 */}
      <View className="gap-2">
        <Typography variant="labelCaps" className="text-on-surface-variant">
          Price per unit
        </Typography>
        <TextInput
          className={errors.unitPrice || errors.priceUnit ? inputErrorClassName : inputClassName}
          placeholder="e.g. 0.004"
          placeholderTextColor={colors['on-surface-variant']}
          keyboardType="decimal-pad"
          value={form.unitPrice}
          onChangeText={(v) => set('unitPrice', v)}
        />
        <View className="flex-row flex-wrap items-center gap-2">
          {PRICE_UNITS.map((u) => (
            <Pressable key={u} onPress={() => set('priceUnit', u)}>
              <Chip label={u} tone={form.priceUnit === u ? 'tertiarySoft' : 'surfaceContainer'} />
            </Pressable>
          ))}
          <TextInput
            className={`${inputClassName} min-w-[72px] px-3 py-1.5`}
            placeholder="unit"
            placeholderTextColor={colors['on-surface-variant']}
            value={form.priceUnit}
            onChangeText={(v) => set('priceUnit', v)}
          />
        </View>
        <FieldError message={errors.unitPrice ?? errors.priceUnit} />
      </View>

      {/* 库存（可选） */}
      <View className="gap-2">
        <Typography variant="labelCaps" className="text-on-surface-variant">
          Stock (optional)
        </Typography>
        <View className="flex-row gap-2">
          <TextInput
            className={`${errors.stockAmount ? inputErrorClassName : inputClassName} flex-1`}
            placeholder="e.g. 500"
            placeholderTextColor={colors['on-surface-variant']}
            keyboardType="decimal-pad"
            value={form.stockAmount}
            onChangeText={(v) => set('stockAmount', v)}
          />
          <TextInput
            className={`${inputClassName} min-w-[96px]`}
            placeholder={form.priceUnit || 'unit'}
            placeholderTextColor={colors['on-surface-variant']}
            value={form.stockUnit}
            onChangeText={(v) => set('stockUnit', v)}
          />
        </View>
        <FieldError message={errors.stockAmount} />
      </View>

      {/* 备注（可选） */}
      <View className="gap-2">
        <Typography variant="labelCaps" className="text-on-surface-variant">
          Notes (optional)
        </Typography>
        <TextInput
          className={inputClassName}
          placeholder="Brand, store, ..."
          placeholderTextColor={colors['on-surface-variant']}
          value={form.notes}
          onChangeText={(v) => set('notes', v)}
        />
      </View>

      {submitError != null && (
        <Typography variant="bodyMd" className="text-error">
          {submitError instanceof ApiClientError ? submitError.message : String(submitError)}
        </Typography>
      )}

      <Button
        label={submitting ? 'Saving...' : submitLabel}
        variant="cta"
        disabled={submitting}
        onPress={handleSubmit}
      />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
