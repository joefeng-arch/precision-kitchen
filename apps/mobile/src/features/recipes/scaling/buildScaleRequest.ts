import type { PercentBase, ScaleRequest } from '@/lib/api/types';

export function buildBakersPercentageRequest(mode: 'anchor' | 'total', value: number): ScaleRequest {
  return { profile: 'bakers_percentage', bakersLock: { mode, value } };
}

export function buildRatioBasedRequest(lockedId: number, value: number): ScaleRequest {
  return { profile: 'ratio_based', ratioLock: { id: lockedId, value } };
}

export function buildMultiRatioRequest(
  groupValues: Record<string, { lockedId: number; lockedValue: number }>,
  percentBase: PercentBase | undefined,
): ScaleRequest {
  return {
    profile: 'multi_ratio',
    multiRatio: {
      groups: Object.entries(groupValues).map(([group, { lockedId, lockedValue }]) => ({
        group,
        lockedId,
        lockedValue,
      })),
      percentBase,
    },
  };
}
