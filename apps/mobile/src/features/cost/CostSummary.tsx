import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Typography } from '@/components/ui';
import { ApiClientError } from '@/lib/api/errors';
import { useRecipeCost } from '@/lib/api/hooks/useRecipeCost';
import type { CostLine, ScaleRequest } from '@/lib/api/types';
import { colors } from '@/lib/theme/tokens';

import { formatMoney } from './deriveCostScale';

function LineRow({ line, currency }: { line: CostLine; currency: string }) {
  const unpriced = line.source === 'unknown';
  return (
    <View className="flex-row items-center gap-3 py-1.5">
      <View className="flex-1">
        <Typography variant="bodyMd" className={unpriced ? 'text-on-surface-variant' : undefined}>
          {line.name}
        </Typography>
      </View>
      <Typography variant="measurementSm" className="text-on-surface-variant">
        {line.amount} {line.unit}
      </Typography>
      <View className="min-w-[64px] items-end">
        <Typography variant="measurementSm" className={unpriced ? 'text-on-surface-variant' : undefined}>
          {unpriced ? '—' : formatMoney(currency, line.totalCost)}
        </Typography>
      </View>
    </View>
  );
}

export interface CostSummaryProps {
  recipeId: string;
  /** null = 原始用量；缩放工作台传当前锁定请求体（hook 内部 debounce） */
  scale: ScaleRequest | null;
}

/**
 * 配方成本卡（契约 §11）。403 = 服务端 COST_PRO_ONLY 门禁 → 锁定 CTA；
 * 门禁开关只有服务端知道，客户端不做 tier 预判（免得门禁关着还锁 FREE 用户）。
 * 其它错误安静降级，绝不阻塞配方页。
 */
export function CostSummary({ recipeId, scale }: CostSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const cost = useRecipeCost(recipeId, scale);

  if (cost.error instanceof ApiClientError && cost.error.code === 403) {
    return (
      <View className="rounded-lg border border-surface-variant/60 bg-surface-container-lowest p-4">
        <View className="flex-row items-center gap-2">
          <MaterialIcons name="lock" size={18} color={colors['on-surface-variant']} />
          <Typography variant="bodyLg">Cost insights are a PRO feature</Typography>
        </View>
        <Typography variant="bodyMd" className="mt-1 text-on-surface-variant">
          See what every batch costs, at any scale.
        </Typography>
        <Button
          label="Upgrade to PRO"
          variant="primary"
          className="mt-3 self-start"
          onPress={() => router.push('/paywall')}
        />
      </View>
    );
  }

  if (cost.error) {
    return (
      <Typography variant="bodyMd" className="text-on-surface-variant">
        Cost estimate unavailable.
      </Typography>
    );
  }

  if (!cost.data) {
    return (
      <Typography variant="bodyMd" className="text-on-surface-variant">
        Estimating cost...
      </Typography>
    );
  }

  const { currency, totalCost, unknownCount, lines } = cost.data;
  // 全员未定价时 $0.00 具误导性（手机实测：用户以为成本就是零）——改占位符 + 引导
  const nothingPriced = lines.length > 0 && unknownCount === lines.length;

  return (
    <View className="rounded-lg border border-surface-variant/60 bg-surface-container-lowest p-4">
      <Pressable
        className="flex-row items-center justify-between"
        onPress={() => setExpanded((e) => !e)}
      >
        <View className="flex-row items-center gap-2">
          <Typography variant="labelCaps" className="text-on-surface-variant">
            Estimated cost
          </Typography>
          {cost.isFetching && (
            <Typography variant="bodyMd" className="text-on-surface-variant">
              …
            </Typography>
          )}
        </View>
        <View className="flex-row items-center gap-2">
          <Typography variant="measurementLg">
            {nothingPriced ? '—' : formatMoney(currency, totalCost)}
          </Typography>
          <MaterialIcons
            name={expanded ? 'expand-less' : 'expand-more'}
            size={20}
            color={colors['on-surface-variant']}
          />
        </View>
      </Pressable>

      {nothingPriced ? (
        <Typography variant="bodyMd" className="mt-1 text-on-surface-variant">
          Add pantry prices to estimate this recipe&apos;s cost.
        </Typography>
      ) : unknownCount > 0 ? (
        <Typography variant="bodyMd" className="mt-1 text-on-surface-variant">
          {unknownCount} {unknownCount === 1 ? 'ingredient' : 'ingredients'} unpriced — add{' '}
          {unknownCount === 1 ? 'it' : 'them'} to your pantry for a fuller estimate.
        </Typography>
      ) : null}

      {expanded && (
        <View className="mt-3 border-t border-surface-variant/40 pt-2">
          {lines.map((line, i) => (
            <LineRow key={`${line.ingredientId ?? 'c'}-${i}`} line={line} currency={currency} />
          ))}
        </View>
      )}
    </View>
  );
}
