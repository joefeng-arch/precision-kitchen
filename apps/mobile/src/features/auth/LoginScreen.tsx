import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button, Screen, Typography } from '@/components/ui';
import { useAuthStore } from '@/lib/store/authStore';

export function LoginScreen() {
  const loginWithMock = useAuthStore((s) => s.loginWithMock);
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await loginWithMock(nickname.trim() || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-6 px-6">
        <Typography variant="displayLg" className="text-primary">
          Precision Kitchen
        </Typography>
        <TextInput
          value={nickname}
          onChangeText={setNickname}
          placeholder="Nickname (optional)"
          placeholderTextColor="#877365"
          className="w-full rounded-lg bg-surface-container px-4 py-3 font-body-md text-body-md text-on-surface"
        />
        <Button
          label={submitting ? 'Continue...' : 'Continue'}
          variant="cta"
          className="w-full"
          disabled={submitting}
          onPress={handleSubmit}
        />
        {error && (
          <Typography variant="bodyMd" className="text-error">
            {error}
          </Typography>
        )}
      </View>
    </Screen>
  );
}
