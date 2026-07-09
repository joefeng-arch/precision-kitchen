import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { TokenPayload } from 'google-auth-library';
import { GoogleAuthProvider } from './google-auth.provider';
import { AuthService } from '../auth.service';

/** 极简 ConfigService 替身：按 map 返回，缺失走 default */
function fakeConfig(values: Record<string, string>): ConfigService {
  return {
    get: (key: string, def?: string) => values[key] ?? def,
  } as unknown as ConfigService;
}

/** 覆写网络校验隔离点：返回固定 payload 或抛错，并记录实际收到的 audience */
class TestableGoogleAuthProvider extends GoogleAuthProvider {
  capturedAudience: string[] | null = null;

  constructor(
    config: ConfigService,
    private readonly verify: () => Promise<TokenPayload | undefined>,
  ) {
    super(config);
  }

  protected verifyToken(_idToken: string, audience: string[]) {
    this.capturedAudience = audience;
    return this.verify();
  }
}

const GOOGLE_ENV = {
  GOOGLE_IOS_CLIENT_ID: 'ios-client-id',
  GOOGLE_ANDROID_CLIENT_ID: 'android-client-id',
  GOOGLE_WEB_CLIENT_ID: 'web-client-id',
};

function googlePayload(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    iss: 'https://accounts.google.com',
    sub: 'google-sub-123',
    aud: 'web-client-id',
    exp: 0,
    iat: 0,
    name: 'Joe G',
    picture: 'https://lh3.googleusercontent.com/a/pic',
    ...overrides,
  } as TokenPayload;
}

describe('GoogleAuthProvider', () => {
  it('合法 idToken → externalId=sub，昵称/头像取 token claims', async () => {
    const provider = new TestableGoogleAuthProvider(fakeConfig(GOOGLE_ENV), () =>
      Promise.resolve(googlePayload()),
    );
    const result = await provider.authenticate({ code: 'fake-id-token' });
    expect(result.externalId).toBe('google-sub-123');
    expect(result.unionId).toBeNull();
    expect(result.profile?.nickname).toBe('Joe G');
    expect(result.profile?.avatar).toBe('https://lh3.googleusercontent.com/a/pic');
    expect(provider.providerType).toBe('google');
  });

  it('客户端透传 profile 优先于 token claims', async () => {
    const provider = new TestableGoogleAuthProvider(fakeConfig(GOOGLE_ENV), () =>
      Promise.resolve(googlePayload()),
    );
    const result = await provider.authenticate({
      code: 'fake-id-token',
      profile: { nickname: '自定义昵称', avatar: 'https://cdn.example.com/me.png' },
    });
    expect(result.profile?.nickname).toBe('自定义昵称');
    expect(result.profile?.avatar).toBe('https://cdn.example.com/me.png');
  });

  it('token 无 name/picture 且无透传 → nickname/avatar 保持 undefined（新建走 upsert 默认，已存在不覆盖）', async () => {
    const provider = new TestableGoogleAuthProvider(fakeConfig(GOOGLE_ENV), () =>
      Promise.resolve(googlePayload({ name: undefined, picture: undefined })),
    );
    const result = await provider.authenticate({ code: 'fake-id-token' });
    expect(result.profile?.nickname).toBeUndefined();
    expect(result.profile?.avatar).toBeUndefined();
  });

  it('配置了几个平台 Client ID，audience 白名单就有几个（缺省项被过滤）', async () => {
    const provider = new TestableGoogleAuthProvider(
      fakeConfig({ GOOGLE_WEB_CLIENT_ID: 'web-client-id' }),
      () => Promise.resolve(googlePayload()),
    );
    await provider.authenticate({ code: 'fake-id-token' });
    expect(provider.capturedAudience).toEqual(['web-client-id']);
  });

  it('未配置任何 Client ID → 抛 Unauthorized（fail closed，不发起校验）', async () => {
    const provider = new TestableGoogleAuthProvider(fakeConfig({}), () =>
      Promise.resolve(googlePayload()),
    );
    await expect(provider.authenticate({ code: 'x' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(provider.capturedAudience).toBeNull();
  });

  it('校验失败（签名/过期/aud 不符）→ 统一抛 Unauthorized，不泄露底层错误', async () => {
    const provider = new TestableGoogleAuthProvider(fakeConfig(GOOGLE_ENV), () =>
      Promise.reject(new Error('Wrong recipient, payload audience != requiredAudience')),
    );
    await expect(provider.authenticate({ code: 'bad-token' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('payload 缺 sub → 抛 Unauthorized', async () => {
    const provider = new TestableGoogleAuthProvider(fakeConfig(GOOGLE_ENV), () =>
      Promise.resolve(googlePayload({ sub: undefined as unknown as string })),
    );
    await expect(provider.authenticate({ code: 'x' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('AuthService.login("google") 端到端签发 JWT（DB 层 mock）', () => {
  it('用 google provider 走完整登录流程，拿到可解码的 JWT', async () => {
    const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '7d' } });

    const savedUser: any = {
      id: 'user-g1',
      openid: null,
      role: 'user',
      nickname: 'Joe G',
      avatar: null,
      lastLoginAt: null,
    };
    const usersMock: any = {
      upsertByExternalId: jest.fn().mockResolvedValue(savedUser),
      save: jest.fn().mockResolvedValue(savedUser),
    };

    const googleProvider = new TestableGoogleAuthProvider(fakeConfig(GOOGLE_ENV), () =>
      Promise.resolve(googlePayload()),
    );

    const service = new AuthService(usersMock, jwt, [googleProvider]);
    const res = await service.login('google', { code: 'fake-id-token' });

    expect(typeof res.token).toBe('string');
    const decoded = jwt.verify(res.token) as any;
    expect(decoded.sub).toBe('user-g1');
    expect(decoded.role).toBe('user');

    expect(usersMock.upsertByExternalId).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google', externalId: 'google-sub-123' }),
    );
    expect(res.user.id).toBe('user-g1');
  });
});
