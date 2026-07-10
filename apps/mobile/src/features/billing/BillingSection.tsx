import { router } from 'expo-router';
import { View } from 'react-native';

import { Button, Chip, Typography } from '@/components/ui';
import { useBillingStatus } from '@/lib/api/hooks/useBillingStatus';
import { useAuthStore } from '@/lib/store/authStore';

/** Me 页的订阅区块：层级 + 配额用量 + 升级入口。数据源 /billing/status（authStore role 兜底）。 */
export function BillingSection() {
  const { data } = useBillingStatus();
  const fallbackRole = useAuthStore((s) => s.user?.role ?? 'user');

  const tier = data?.tier ?? fallbackRole;
  const isPro = tier === 'vip';

  return (
    <View className="gap-3 rounded-xl border border-card-border bg-surface-container-lowest p-4">
      <View className="flex-row items-center justify-between">
        <Typography variant="labelCaps" className="text-on-surface-variant">
          Subscription
        </Typography>
        <Chip label={isPro ? 'PRO' : 'FREE'} tone={isPro ? 'tertiarySoft' : 'surfaceContainer'} />
      </View>

      {isPro && data?.vipExpiresAt && (
        <Typography variant="bodyMd" className="text-on-surface-variant">
          Renews / expires {new Date(data.vipExpiresAt).toLocaleDateString()}
        </Typography>
      )}

      {data && (
        <View className="gap-1">
          <Typography variant="bodyMd">
            Recipes {data.quotas.recipes.used} / {data.quotas.recipes.limit ?? 'Unlimited'}
          </Typography>
          <Typography variant="bodyMd">
            AI imports {data.quotas.aiParse.used} / {data.quotas.aiParse.limit} this month
          </Typography>
        </View>
      )}

      {!isPro && (
        <Button
          variant="cta"
          label="Upgrade to PRO"
          onPress={() => router.push('/paywall')}
        />
      )}
    </View>
  );
}
