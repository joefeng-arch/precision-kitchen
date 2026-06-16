/**
 * ═══════════════════════════════════════════════════════════════
 *  金额存储与转换规范
 * ═══════════════════════════════════════════════════════════════
 *
 *  ## 规则
 *
 *  | 场景              | 存储类型            | 说明                              |
 *  |-------------------|---------------------|-----------------------------------|
 *  | 订单金额 / 订阅价 | INTEGER（分）       | 1 = 0.01 元，避免浮点精度丢失     |
 *  | 食材单价           | DECIMAL(12,4)       | 精度要求高（0.0001 元/克）        |
 *  | 食材用量           | DECIMAL(10,2)       | 克/毫升等度量单位                 |
 *  | 烹饪成本           | DECIMAL(10,2)       | 由单价 × 用量计算得出             |
 *
 *  ## 前后端约定
 *
 *  - 后端 DTO：订单/订阅金额字段命名以 `Cents` 结尾（如 `amountCents`），
 *    表示整数分；前端展示时 ÷ 100 转为元。
 *  - 食材类金额字段保留原名（如 `unitPrice`、`totalCost`），
 *    值为浮点数（元），精度由数据库 DECIMAL 保证。
 */

/**
 * 元 → 分（四舍五入到整数）
 * 用于：前端输入元 → 后端存储整数分
 */
export function yuanToCents(yuan: number): number {
  return Math.round(yuan * 100);
}

/**
 * 分 → 元（保留两位小数）
 * 用于：后端整数分 → 前端展示元
 */
export function centsToYuan(cents: number): number {
  return cents / 100;
}

/**
 * 格式化分为人民币字符串
 * @example formatCents(1999) → "¥19.99"
 * @example formatCents(1999, { prefix: false }) → "19.99"
 */
export function formatCents(
  cents: number,
  options?: { prefix?: boolean; decimals?: number },
): string {
  const { prefix = true, decimals = 2 } = options ?? {};
  const yuan = (cents / 100).toFixed(decimals);
  return prefix ? `¥${yuan}` : yuan;
}

/**
 * 安全的金额乘法（避免浮点误差）
 * 将两个浮点数的乘积四舍五入到指定小数位
 * @example safeMultiply(0.1, 0.2, 4) → 0.02（而非 0.020000000000000004）
 */
export function safeMultiply(a: number, b: number, decimals = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(a * b * factor) / factor;
}
