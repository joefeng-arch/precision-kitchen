import { View } from 'react-native';

import { Typography } from '@/components/ui';
import type { ParseConfidence } from '@/lib/api/types';

export interface ParseQualityCalloutProps {
  confidence: ParseConfidence;
  /** 服务端中文文案，原样展示（服务端 i18n 是已知缺口，不在本切片） */
  warnings: string[];
}

/**
 * high 且无 warnings → 不渲染（上方 chip 行已示 High confidence）；
 * medium / 有 warnings → 普通边框卡片列 warnings；
 * low → 醒目 error 边框卡片（服务端 linear_legacy 降级恒为 low + 说明性 warnings）。
 */
export function ParseQualityCallout({ confidence, warnings }: ParseQualityCalloutProps) {
  if (confidence === 'low') {
    return (
      <View
        testID="low-confidence-callout"
        className="rounded-lg border border-error bg-surface-container p-4"
      >
        <Typography variant="labelCaps" className="text-error">
          Low confidence
        </Typography>
        <Typography variant="bodyMd" className="mt-1">
          Check this recipe carefully before saving.
        </Typography>
        {warnings.map((w, i) => (
          <Typography key={i} variant="bodyMd" className="mt-1 text-on-surface-variant">
            • {w}
          </Typography>
        ))}
      </View>
    );
  }

  if (warnings.length === 0) return null;

  return (
    <View className="rounded-lg border border-outline-variant bg-surface-container p-4">
      {warnings.map((w, i) => (
        <Typography key={i} variant="bodyMd" className="text-on-surface-variant">
          • {w}
        </Typography>
      ))}
    </View>
  );
}
