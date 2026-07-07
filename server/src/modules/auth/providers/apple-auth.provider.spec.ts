import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AppleIdTokenType } from 'apple-signin-auth';
import { AppleAuthProvider } from './apple-auth.provider';
import { AuthService } from '../auth.service';

/** 极简 ConfigService 替身：按 map 返回，缺失走 default */
function fakeConfig(values: Record<string, string>): ConfigService {
  return {
    get: (key: string, def?: string) => values[key] ?? def,
  } as unknown as ConfigService;
}

/** 覆写网络校验隔离点：返回固定 payload 或抛错，并记录实际收到的 audience */
class TestableAppleAuthProvider extends AppleAuthProvider {
  capturedAudience: string | null = null;

  constructor(
    config: ConfigService,
    private readonly verify: () => Promise<AppleIdTokenType>,
  ) {
    super(config);
  }

  protected verifyToken(_idToken: string, audience: string) {
    this.capturedAudience = audience;
    return this.verify();
  }
}

const APPLE_ENV = { APPLE_CLIENT_ID: 'com.example.precisionkitchen.web' };

function applePayload(overrides: Partial<AppleIdTokenType> = {}): AppleIdTokenType {
  return {
    iss: 'https://appleid.apple.com',
    sub: 'apple-sub-001',
    aud: 'com.example.precisionkitchen.web',
    exp: '0',
    iat: '0',
    nonce: 'n',
    nonce_supported: true,
    email: 'relay@privaterelay.appleid.com',
    email_verified: true,
    is_private_email: true,
    ...overrides,
  };
}

describe('AppleAuthProvider', () => {
  it('首次登录：Apple 仅传一次 fullName，通过 profile.nickname 透传', async () => {
    const provider = new TestableAppleAuthProvider(fakeConfig(APPLE_ENV), () =>
      Promise.resolve(applePayload()),
    );
    const result = await provider.authenticate({
      code: 'fake-identity-token',
      profile: { nickname: 'Joe Feng' },
    });
    expect(result.externalId).toBe('apple-sub-001');
    expect(result.unionId).toBeNull();
    expect(result.profile?.nickname).toBe('Joe Feng');
    expect(provider.providerType).toBe('apple');
    expect(provider.capturedAudience).toBe('com.example.precisionkitchen.web');
  });

  it('后续登录：profile 缺失 → nickname/avatar 保持 undefined，不覆盖已存资料', async () => {
    // 关键：upsertByExternalId 对 truthy nickname 会覆盖已存值。
    // Apple 的 identityToken 不含姓名，后续登录若回落默认昵称会把首次透传的真名冲掉。
    const provider = new TestableAppleAuthProvider(fakeConfig(APPLE_ENV), () =>
      Promise.resolve(applePayload()),
    );
    const result = await provider.authenticate({ code: 'fake-identity-token' });
    expect(result.externalId).toBe('apple-sub-001');
    expect(result.profile?.nickname).toBeUndefined();
    expect(result.profile?.avatar).toBeUndefined();
  });

  it('未配置 APPLE_CLIENT_ID → 抛 Unauthorized（fail closed，不发起校验）', async () => {
    const provider = new TestableAppleAuthProvider(fakeConfig({}), () =>
      Promise.resolve(applePayload()),
    );
    await expect(provider.authenticate({ code: 'x' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(provider.capturedAudience).toBeNull();
  });

  it('校验失败（签名/过期/aud 不符）→ 统一抛 Unauthorized，不泄露底层错误', async () => {
    const provider = new TestableAppleAuthProvider(fakeConfig(APPLE_ENV), () =>
      Promise.reject(new Error('jwt audience invalid')),
    );
    await expect(provider.authenticate({ code: 'bad-token' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('payload 缺 sub → 抛 Unauthorized', async () => {
    const provider = new TestableAppleAuthProvider(fakeConfig(APPLE_ENV), () =>
      Promise.resolve(applePayload({ sub: undefined as unknown as string })),
    );
    await expect(provider.authenticate({ code: 'x' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('AuthService.login("apple") 端到端签发 JWT（DB 层 mock）', () => {
  it('用 apple provider 走完整登录流程，拿到可解码的 JWT', async () => {
    const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '7d' } });

    const savedUser: any = {
      id: 'user-a1', openid: null, role: 'user',
      nickname: 'Joe Feng', avatar: null, lastLoginAt: null,
    };
    const usersMock: any = {
      upsertByExternalId: jest.fn().mockResolvedValue(savedUser),
      save: jest.fn().mockResolvedValue(savedUser),
    };

    const appleProvider = new TestableAppleAuthProvider(fakeConfig(APPLE_ENV), () =>
      Promise.resolve(applePayload()),
    );

    const service = new AuthService(usersMock, jwt, [appleProvider]);
    const res = await service.login('apple', {
      code: 'fake-identity-token',
      profile: { nickname: 'Joe Feng' },
    });

    expect(typeof res.token).toBe('string');
    const decoded = jwt.verify(res.token) as any;
    expect(decoded.sub).toBe('user-a1');
    expect(decoded.role).toBe('user');

    expect(usersMock.upsertByExternalId).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'apple',
        externalId: 'apple-sub-001',
        nickname: 'Joe Feng',
      }),
    );
    expect(res.user.id).toBe('user-a1');
  });
});
