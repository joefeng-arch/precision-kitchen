import { MaterialIcons } from '@expo/vector-icons';
import { ScrollView, TextInput, View } from 'react-native';

import { Button, Chip, Screen, Typography } from '@/components/ui';
import { ApiClientError } from '@/lib/api/errors';
import { colors } from '@/lib/theme/tokens';
import type { ParseConfidence, ParsedRecipe } from '@/lib/api/types';

import { scalingProfileLabels } from '../scalingProfileLabels';
import { IngredientRow } from './IngredientRow';
import { ParseQualityCallout } from './ParseQualityCallout';

export interface ConfirmViewProps {
  draft: ParsedRecipe;
  confidence: ParseConfidence;
  warnings: string[];
  /** 客户端删除承重原料触发的降级（sticky） */
  downgraded: boolean;
  saving: boolean;
  saveError: unknown;
  onChangeTitle: (title: string) => void;
  onDeleteIngredient: (index: number) => void;
  onBack: () => void;
  onSave: () => void;
}

export function ConfirmView({
  draft,
  confidence,
  warnings,
  downgraded,
  saving,
  saveError,
  onChangeTitle,
  onDeleteIngredient,
  onBack,
  onSave,
}: ConfirmViewProps) {
  return (
    <Screen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 24, gap: 16 }}
      >
        <View className="flex-row">
          <Button variant="secondary" label="Back to text" onPress={onBack} />
        </View>

        <Typography variant="headlineMd">Confirm import</Typography>

        <TextInput
          value={draft.title}
          onChangeText={onChangeTitle}
          placeholder="Recipe title"
          placeholderTextColor="#877365"
          className="w-full rounded-lg bg-surface-container px-4 py-3 font-body-md text-body-md text-on-surface"
        />

        <View className="flex-row gap-2">
          <Chip label={scalingProfileLabels[draft.scalingProfile]} tone="tertiarySoft" />
          {confidence !== 'low' && (
            <Chip
              label={confidence === 'high' ? 'High confidence' : 'Medium confidence'}
              tone="surfaceContainer"
            />
          )}
        </View>

        <ParseQualityCallout confidence={confidence} warnings={warnings} />

        {downgraded && (
          <View
            testID="downgrade-notice"
            className="rounded-lg border border-outline-variant bg-surface-container p-4"
          >
            <Typography variant="bodyMd" className="text-on-surface-variant">
              Removing that ingredient broke the scaling setup — this will be saved as a
              regular recipe.
            </Typography>
          </View>
        )}

        <Typography variant="labelCaps" className="text-on-surface-variant">
          Ingredients ({draft.ingredients.length})
        </Typography>
        <View className="gap-3">
          {draft.ingredients.map((ing, i) => (
            <IngredientRow
              key={`${ing.name}-${i}`}
              ingredient={ing}
              onDelete={() => onDeleteIngredient(i)}
            />
          ))}
        </View>

        <Typography variant="labelCaps" className="text-on-surface-variant">
          Steps ({draft.steps.length})
        </Typography>
        <View className="gap-2">
          {draft.steps.map((s) => (
            <View key={s.stepNumber} className="flex-row gap-3">
              <Typography variant="measurementSm" className="text-on-surface-variant">
                {s.stepNumber}
              </Typography>
              <View className="flex-1">
                <Typography variant="bodyMd">{s.description}</Typography>
                {s.warning && (
                  <View className="mt-1 flex-row items-start gap-2">
                    <MaterialIcons
                      name="warning"
                      size={14}
                      color={colors['primary-container']}
                      style={{ marginTop: 5 }}
                    />
                    <Typography variant="bodyMd" className="flex-1 text-on-surface-variant">
                      {s.warning}
                    </Typography>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>

        {saveError != null && (
          <Typography testID="save-error" variant="bodyMd" className="text-error">
            {saveError instanceof ApiClientError ? saveError.message : String(saveError)}
          </Typography>
        )}

        <Button
          variant="cta"
          label={saving ? 'Saving...' : 'Save as draft'}
          disabled={saving || draft.ingredients.length === 0}
          onPress={onSave}
        />
      </ScrollView>
    </Screen>
  );
}
