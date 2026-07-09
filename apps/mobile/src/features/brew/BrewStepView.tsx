import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { fonts, radii } from '@/lib/theme/tokens';
import type { RecipeStep, TimerStatus } from '@/lib/api/types';

import { DarkText } from './DarkText';

export interface BrewStepViewProps {
  step: RecipeStep;
  nextStep: RecipeStep | null;
  displaySeconds: number | null;
  timerStatus: TimerStatus | null;
  isLastStep: boolean;
  onPause: () => void;
  onResume: () => void;
  onAdvance: () => void;
}

function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function BrewStepView({
  step,
  nextStep,
  displaySeconds,
  timerStatus,
  isLastStep,
  onPause,
  onResume,
  onAdvance,
}: BrewStepViewProps) {
  const hasTimer = displaySeconds != null;
  const isPaused = timerStatus === 'paused';

  return (
    <View className="flex-1 items-center justify-center px-6">
      <DarkText variant="labelCaps" color="#C9C2B5">
        STEP {step.stepNumber}
      </DarkText>

      {hasTimer && (
        <Text
          style={{
            fontFamily: fonts.measurementLg,
            fontSize: 72,
            lineHeight: 80,
            color: '#FBF8F2',
            marginTop: 8,
          }}
        >
          {formatClock(displaySeconds)}
        </Text>
      )}

      <DarkText
        variant={hasTimer ? 'bodyLg' : 'headlineMd'}
        color="#FBF8F2"
        style={{ textAlign: 'center', marginTop: hasTimer ? 24 : 16 }}
      >
        {step.description}
      </DarkText>

      {step.warning && (
        // 失败关键提醒：heat 边框 callout，正文 bodyLg（大于 tips），排在 tips 之前
        <View
          style={{
            alignSelf: 'stretch',
            alignItems: 'center',
            marginTop: 16,
            borderWidth: 1,
            borderColor: '#D9622B',
            borderRadius: radii.md,
            paddingVertical: 12,
            paddingHorizontal: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialIcons name="warning" size={14} color="#D9622B" />
            <DarkText variant="labelCaps" color="#D9622B">
              CRITICAL
            </DarkText>
          </View>
          <DarkText
            variant="bodyLg"
            color="#FBF8F2"
            style={{ textAlign: 'center', marginTop: 4 }}
          >
            {step.warning}
          </DarkText>
        </View>
      )}

      {step.tips && (
        <DarkText variant="bodyMd" color="#C9C2B5" style={{ textAlign: 'center', marginTop: 12 }}>
          {step.tips}
        </DarkText>
      )}

      {nextStep && (
        <View className="mt-10 items-center">
          <DarkText variant="labelCaps" color="#D9622B">
            NEXT
          </DarkText>
          <DarkText
            variant="bodyMd"
            color="#C9C2B5"
            style={{ textAlign: 'center', marginTop: 4 }}
            numberOfLines={1}
          >
            {nextStep.description}
          </DarkText>
        </View>
      )}

      <View className="mt-10 w-full gap-3">
        {hasTimer ? (
          <>
            <Button
              variant="cta"
              label={isPaused ? 'Resume' : 'Pause'}
              icon={
                <MaterialIcons name={isPaused ? 'play-arrow' : 'pause'} size={20} color="#4b2600" />
              }
              onPress={isPaused ? onResume : onPause}
            />
            <Pressable onPress={onAdvance} className="items-center py-3">
              <DarkText variant="bodyMd" color="#C9C2B5">
                Skip to next step
              </DarkText>
            </Pressable>
          </>
        ) : (
          <Button
            variant="cta"
            label={isLastStep ? 'Finish' : 'Mark Done · Next Step'}
            icon={<MaterialIcons name="check" size={20} color="#4b2600" />}
            onPress={onAdvance}
          />
        )}
      </View>
    </View>
  );
}
