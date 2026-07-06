import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Screen, Typography } from '@/components/ui';
import { colors } from '@/lib/theme/tokens';

export default function BrewScreen() {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-4 p-6">
        <Typography variant="headlineMd" className="text-center">
          Ready to cook?
        </Typography>
        <Typography variant="bodyMd" className="text-on-surface-variant text-center">
          Open a recipe and tap "Start Cooking" to begin a guided, timer-backed session.
        </Typography>
        <Button
          label="Browse recipes"
          variant="cta"
          icon={<MaterialIcons name="restaurant-menu" size={20} color={colors['on-primary-container']} />}
          onPress={() => router.push('/')}
          className="mt-4"
        />
      </View>
    </Screen>
  );
}
