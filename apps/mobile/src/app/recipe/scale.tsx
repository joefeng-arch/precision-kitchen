import { router } from 'expo-router';

import { Button, Screen, Typography } from '@/components/ui';

// Stub only — the real scaling workbench is out of scope for this step.
export default function ScaleScreen() {
  return (
    <Screen>
      <Typography variant="headlineMd" className="p-6">
        Scaling workbench — coming soon.
      </Typography>
      <Button label="Back" variant="secondary" onPress={() => router.back()} className="mx-6" />
    </Screen>
  );
}
