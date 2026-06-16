/**
 * ═══════════════════════════════════════════════════════════════
 *  AuthProvider — 登录提供者抽象接口
 * ═══════════════════════════════════════════════════════════════
 *
 *  所有第三方登录（微信、Apple、Google 等）都实现此接口。
 *  auth.service 依赖接口，而非具体实现。
 *
 *  扩展步骤：
 *  1. 新建 providers/apple-auth.provider.ts，实现 AuthProvider
 *  2. 在 auth.module.ts 中注册为 { provide: AUTH_PROVIDERS, useClass: AppleAuthProvider, multi: true }
 *  3. auth.service 自动识别 providerType 并路由到对应实现
 *
 *  @example
 *  ```typescript
 *  // providers/google-auth.provider.ts
 *  @Injectable()
 *  export class GoogleAuthProvider implements AuthProvider {
 *    readonly providerType = 'google';
 *    async authenticate(credentials) {
 *      const ticket = await googleClient.verifyIdToken({ idToken: credentials.code });
 *      const payload = ticket.getPayload();
 *      return { externalId: payload.sub, unionId: null, profile: { ... } };
 *    }
 *  }
 *  ```
 */

/**
 * 认证结果：由具体 provider 返回，auth.service 用来 upsert 用户
 */
export interface AuthResult {
  /** 第三方平台的用户唯一标识（微信 openid / Apple sub / Google sub） */
  externalId: string;
  /** 跨平台统一标识（微信 unionid），可选 */
  unionId?: string | null;
  /** 用户公开资料（首次注册或更新用） */
  profile?: {
    nickname?: string;
    avatar?: string | null;
  };
}

/**
 * 登录凭证：前端传来的认证凭据
 */
export interface AuthCredentials {
  /** 授权码 / token / idToken（微信 code、Apple identityToken 等） */
  code: string;
  /** 附加资料（可选，如微信首次登录传 nickname/avatar） */
  profile?: {
    nickname?: string;
    avatar?: string | null;
  };
}

/**
 * 认证提供者接口 — 所有登录方式的抽象
 */
export interface AuthProvider {
  /**
   * 提供者类型标识，用于路由
   * 'wechat' | 'apple' | 'google' | 'phone' | ...
   */
  readonly providerType: string;

  /**
   * 执行认证：用前端传来的凭证换取用户身份
   * @throws UnauthorizedException 认证失败时抛出
   */
  authenticate(credentials: AuthCredentials): Promise<AuthResult>;
}

/**
 * 注入令牌 — 用于 NestJS 依赖注入
 *
 * @example
 * // auth.module.ts
 * providers: [
 *   { provide: AUTH_PROVIDERS, useClass: WxAuthProvider, multi: true },
 *   { provide: AUTH_PROVIDERS, useClass: AppleAuthProvider, multi: true },
 * ]
 *
 * // auth.service.ts
 * constructor(@Inject(AUTH_PROVIDERS) private providers: AuthProvider[]) {}
 */
export const AUTH_PROVIDERS = Symbol('AUTH_PROVIDERS');
