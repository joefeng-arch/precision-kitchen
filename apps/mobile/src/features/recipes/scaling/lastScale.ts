import type { ScaleRequest } from '@/lib/api/types';

/**
 * 会话内记住每个配方最近一次缩放（手机实测：用户重进工作台找不到上次结果）。
 * 模块级 Map，无持久化——app 重启即清，跨会话留存/brew 联动另立片。
 */
export interface LastScale {
  /** ServingsRuler（legacy）用：目标份数 */
  servings?: number;
  /** 其余三 profile 用：锁定式请求体 */
  body?: ScaleRequest;
}

const store = new Map<string, LastScale>();

export function getLastScale(recipeId: string): LastScale | undefined {
  return store.get(recipeId);
}

export function setLastScale(recipeId: string, value: LastScale): void {
  store.set(recipeId, value);
}

/** 测试用：清空会话记录 */
export function clearLastScales(): void {
  store.clear();
}
