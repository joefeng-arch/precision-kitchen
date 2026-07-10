import { View } from 'react-native';

import { Button, Screen, Typography } from '@/components/ui';
import { BillingSection } from '@/features/billing/BillingSection';
import { useAuthStore } from '@/lib/store/authStore';

export default function MeScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <Screen>
      <View className="flex-1 gap-4 p-6">
        <Typography variant="headlineMd">{user?.nickname ?? 'Dev User'}</Typography>
        <BillingSection />
        <Button label="Log out" variant="secondary" onPress={() => logout()} />
      </View>
    </Screen>
  );
}
