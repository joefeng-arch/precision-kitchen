import { View } from 'react-native';

import { Typography } from '@/components/ui';

export interface Stat {
  label: string;
  value: string;
}

export function StatBlock({ stats }: { stats: Stat[] }) {
  return (
    <View className="flex-row justify-between rounded-xl border border-surface-variant bg-surface-container-lowest p-4">
      {stats.map((stat, i) => (
        <View key={stat.label} className="flex-row items-center">
          {i > 0 && <View className="mx-4 h-full w-px bg-surface-variant" />}
          <View className="items-center">
            <Typography variant="labelCaps" className="mb-1 text-on-surface-variant">
              {stat.label}
            </Typography>
            <Typography variant="measurementLg" className="text-primary">
              {stat.value}
            </Typography>
          </View>
        </View>
      ))}
    </View>
  );
}
