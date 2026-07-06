import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RecipeStep } from '@/lib/api/types';

import { BrewCompleteView } from './BrewCompleteView';
import { BrewStepView } from './BrewStepView';
import { DarkText } from './DarkText';
import { useBrewSession } from './useBrewSession';

export interface BrewScreenProps {
  recipeId: string;
  title: string;
  steps: RecipeStep[];
}

export function BrewScreen({ recipeId, title, steps }: BrewScreenProps) {
  // Auto-locking mid-brew would strand the user on a step they can't see —
  // keep the screen awake for the lifetime of this component.
  useKeepAwake();

  const session = useBrewSession(recipeId, steps);

  const close = () => {
    session.exit();
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-[#16130F]">
      <View className="flex-row items-center justify-between px-5 py-3">
        <DarkText variant="labelCaps" color="#C9C2B5">
          {session.sessionComplete
            ? title.toUpperCase()
            : `STEP ${session.stepIndex + 1} OF ${session.totalSteps}`}
        </DarkText>
        <Pressable onPress={close} hitSlop={12}>
          <MaterialIcons name="close" size={24} color="#C9C2B5" />
        </Pressable>
      </View>

      {session.sessionComplete || !session.currentStep ? (
        <BrewCompleteView title={title} onDone={close} />
      ) : (
        <BrewStepView
          step={session.currentStep}
          nextStep={session.nextStep}
          displaySeconds={session.displaySeconds}
          timerStatus={session.timerStatus}
          isLastStep={session.stepIndex === session.totalSteps - 1}
          onPause={session.pause}
          onResume={session.resume}
          onAdvance={session.advance}
        />
      )}
    </SafeAreaView>
  );
}
