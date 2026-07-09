/**
 * ═══════════════════════════════════════════════════════════════
 *  PaymentProvider — 支付提供者抽象接口（预留，暂不实现）
 * ═══════════════════════════════════════════════════════════════
 *
 *  统一的下单 / 回调验签 / 退款方法签名。
 *  未来对接：微信支付、Apple IAP、Google Play Billing。
 *
 *  所有金额单位：分（整数），避免浮点精度问题。
 *  前端展示时 / 100 转为元；DTO 层做转换。
 *
 *  扩展步骤：
 *  1. 新建 providers/wx-payment.provider.ts，实现 PaymentProvider
 *  2. 在 payment.module.ts 中注册
 *  3. payment.service 按 providerType 路由
 */

// ─── 通用类型 ─────────────────────────────────────────────────

/** 支付渠道标识 */
export type PaymentChannel = 'wechat' | 'apple_iap' | 'google_play';

/** 订单状态 */
export type OrderStatus =
  | 'pending' // 待支付
  | 'paid' // 已支付
  | 'refunding' // 退款中
  | 'refunded' // 已退款
  | 'cancelled' // 已取消
  | 'failed'; // 支付失败

/** 商品类型 */
export type ProductType =
  | 'subscription' // 订阅（VIP 会员）
  | 'consumable' // 消耗型（积分充值等）
  | 'one_time'; // 一次性购买

// ─── 请求/响应结构 ────────────────────────────────────────────

/** 创建订单请求 */
export interface CreateOrderRequest {
  /** 内部订单号（由业务层生成） */
  orderId: string;
  /** 用户 ID */
  userId: string;
  /** 商品标识 */
  productId: string;
  /** 商品类型 */
  productType: ProductType;
  /** 金额（单位：分） */
  amountCents: number;
  /** 币种 ISO 4217（默认 CNY） */
  currency?: string;
  /** 商品描述（展示给用户） */
  description: string;
  /** 附加元数据（JSON，回调时原样返回） */
  metadata?: Record<string, unknown>;
}

/** 创建订单响应 — 返回前端需要的支付参数 */
export interface CreateOrderResponse {
  /** 内部订单号 */
  orderId: string;
  /**
   * 前端调起支付所需参数（各平台不同）
   * - 微信：{ timeStamp, nonceStr, package, signType, paySign }
   * - Apple IAP：{ transactionId }
   * - Google Play：{ purchaseToken }
   */
  paymentParams: Record<string, string>;
}

/** 支付回调验签结果 */
export interface PaymentNotification {
  /** 内部订单号 */
  orderId: string;
  /** 第三方交易号 */
  transactionId: string;
  /** 实付金额（分） */
  paidAmountCents: number;
  /** 支付时间 */
  paidAt: Date;
  /** 原始回调数据（存档用） */
  rawPayload: unknown;
}

/** 退款请求 */
export interface RefundRequest {
  /** 内部订单号 */
  orderId: string;
  /** 退款金额（分），0 = 全额退款 */
  refundAmountCents: number;
  /** 退款原因 */
  reason?: string;
}

/** 退款响应 */
export interface RefundResponse {
  /** 内部退款单号 */
  refundId: string;
  /** 退款状态 */
  status: 'processing' | 'success' | 'failed';
}

// ─── 核心接口 ─────────────────────────────────────────────────

/**
 * 支付提供者接口
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class WxPaymentProvider implements PaymentProvider {
 *   readonly channel = 'wechat';
 *
 *   async createOrder(req: CreateOrderRequest): Promise<CreateOrderResponse> {
 *     // 调用微信统一下单 API
 *   }
 *
 *   async handleNotification(rawBody: Buffer, headers: Record<string, string>) {
 *     // 验签 + 解密微信回调
 *   }
 *
 *   async refund(req: RefundRequest): Promise<RefundResponse> {
 *     // 调用微信退款 API
 *   }
 * }
 * ```
 */
export interface PaymentProvider {
  /** 支付渠道标识 */
  readonly channel: PaymentChannel;

  /**
   * 创建支付订单，返回前端调起支付所需参数
   * @param request 订单信息（金额单位：分）
   */
  createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse>;

  /**
   * 处理支付平台异步回调（验签 + 解析）
   * @param rawBody 原始请求体
   * @param headers 请求头（用于验签）
   * @returns 验签通过后的支付通知；验签失败时抛异常
   */
  handleNotification(
    rawBody: Buffer | string,
    headers: Record<string, string>,
  ): Promise<PaymentNotification>;

  /**
   * 发起退款
   * @param request 退款请求（金额单位：分）
   */
  refund(request: RefundRequest): Promise<RefundResponse>;

  /**
   * 查询订单支付状态（可选实现）
   * 用于主动轮询 / 对账
   */
  queryOrder?(orderId: string): Promise<{ status: OrderStatus; transactionId?: string }>;
}

/** 注入令牌 */
export const PAYMENT_PROVIDERS = Symbol('PAYMENT_PROVIDERS');
