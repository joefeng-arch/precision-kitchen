/**
 * RevenueCat SDK 薄封装。
 *
 * 现实约束：react-native-purchases 是原生模块，Expo Go 里自动进 Preview API Mode
 * （API 存在但购买是假的）；真实购买要 dev build + 真实 RC key（本片不含）。
 * 因此所有调用 try/catch 收口——Expo Go / key 未配置 / SDK 内部错，一律返回安全值，
 * 页面靠服务端 /billing/status 与 mock 端点完成本地全链路。
 */
import { Platform } from 'react-native';
import Purchases, {
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

/** RC 后台配置的 entitlement id */
export const PRO_ENTITLEMENT_ID = 'pro';

/** offering 不可用时的展示兜底（PRD §5.2 定价） */
export const PRO_PRICES_FALLBACK = { monthly: '$3.99', annual: '$24.99' } as const;

let configuredUserId: string | null = null;

function sdkKey(): string | undefined {
  return Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
    default: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  });
}

/** 登录后调用（appUserID = 我们的 user.id，webhook 反查键）。返回是否已配置。 */
export async function configurePurchases(userId: string): Promise<boolean> {
  const apiKey = sdkKey();
  if (!apiKey) return false;
  try {
    if (configuredUserId === null) {
      Purchases.configure({ apiKey, appUserID: userId });
      configuredUserId = userId;
    } else if (configuredUserId !== userId) {
      await Purchases.logIn(userId);
      configuredUserId = userId;
    }
    return true;
  } catch {
    return false;
  }
}

export async function getProOffering(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch {
    return null;
  }
}

export interface PurchaseResult {
  hasPro: boolean;
  cancelled?: boolean;
}

export async function purchaseProPackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { hasPro: PRO_ENTITLEMENT_ID in (customerInfo.entitlements.active ?? {}) };
  } catch (e) {
    const cancelled = (e as { userCancelled?: boolean })?.userCancelled === true;
    return { hasPro: false, cancelled };
  }
}

export async function restorePurchases(): Promise<PurchaseResult> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { hasPro: PRO_ENTITLEMENT_ID in (customerInfo.entitlements.active ?? {}) };
  } catch {
    return { hasPro: false };
  }
}

/** Paywall 用：SDK 是否已成功 configure（未配置 → 购买按钮禁用，走 mock 路径） */
export function isPurchasesConfigured(): boolean {
  return configuredUserId !== null;
}

/** 仅测试用：重置模块级 configure 状态 */
export function __resetForTest(): void {
  configuredUserId = null;
}
