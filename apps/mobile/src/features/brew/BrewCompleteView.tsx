import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Button } from '@/components/ui';

import { DarkText } from './DarkText';

export interface BrewCompleteViewProps {
  title: string;
  onDone: () => void;
}

export function BrewCompleteView({ title, onDone }: BrewCompleteViewProps) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <MaterialIcons name="check-circle" size={64} color="#2F6F5B" />
      <DarkText variant="headlineMd" color="#FBF8F2" style={{ textAlign: 'center', marginTop: 24 }}>
        {title} done
      </DarkText>
      <DarkText variant="bodyMd" color="#C9C2B5" style={{ textAlign: 'center', marginTop: 8 }}>
        Nice work — every step complete.
      </DarkText>
      <Button
        variant="cta"
        label="Back to Recipe"
        icon={<MaterialIcons name="arrow-back" size={20} color="#4b2600" />}
        onPress={onDone}
        className="mt-10 w-full"
      />
    </View>
  );
}
