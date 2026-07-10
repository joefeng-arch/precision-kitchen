/**
 * FREE/PRO 层级限额（PRD §5.2/§5.3；数值经产品确认）。
 * 放 common：recipes（配方上限）与 billing（状态接口）都要读，
 * 避免 recipes → billing 的反向模块依赖。
 */
import type { UserRole } from '../../modules/users/entities/user.entity';

/** FREE 层配方总数上限（按 authorId 计，含草稿）；PRO 无限 */
export const FREE_RECIPE_LIMIT = 10;

/** AI 解析月度配额：FREE 5 次；PRO 合理使用 30 次（PRD 5.3 成本红线） */
export const PARSE_MONTHLY_LIMIT: Record<UserRole, number> = {
  user: 5,
  vip: 30,
};

/** 月度配额键 TTL：略超一个月，键自然过期无需清理 */
export const PARSE_QUOTA_TTL_MS = 32 * 24 * 60 * 60 * 1000;

/** UTC 日历月（"N 次/月"以 UTC 计，避免时区漂移） */
export function parseQuotaMonth(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7); // YYYY-MM
}

export function parseQuotaKey(userId: string, now: Date = new Date()): string {
  return `parse_quota:${userId}:${parseQuotaMonth(now)}`;
}
