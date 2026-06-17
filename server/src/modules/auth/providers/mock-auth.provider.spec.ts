import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MockAuthProvider } from './mock-auth.provider';
import { AuthService } from '../auth.service';

/** 极简 ConfigService 替身：按 map 返回，缺失走 default */
function fakeConfig(values: Record<string, string>): ConfigService {
  return {
    get: (key: string, def?: string) => values[key] ?? def,
  } as unknown as ConfigService;
}

describe('MockAuthProvider', () => {
  it('dev 环境（ALLOW_MOCK_LOGIN=true）返回 mock-<code> 身份', async () => {
    const provider = new MockAuthProvider(
      fakeConfig({ NODE_ENV: 'development', ALLOW_MOCK_LOGIN: 'true' }),
    );
    const result = await provider.authenticate({ code: 'alice' });
    expect(result.externalId).toBe('mock-alice');
    expect(result.unionId).toBeNull();
    expect(provider.providerType).toBe('mock');
  });

  it('同一 code 始终映射同一 externalId（可重复登录）', async () => {
    const provider = new MockAuthProvider(fakeConfig({ NODE_ENV: 'development' }));
    const a = await provider.authenticate({ code: 'bob' });
    const b = await provider.authenticate({ code: 'bob' });
    expect(a.externalId).toBe(b.externalId);
  });

  it('生产环境默认禁用（ALLOW_MOCK_LOGIN 未设）→ 抛 Unauthorized', async () => {
    const provider = new MockAuthProvider(fakeConfig({ NODE_ENV: 'production' }));
    await expect(provider.authenticate({ code: 'x' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('生产显式 ALLOW_MOCK_LOGIN=false → 抛 Unauthorized', async () => {
    const provider = new MockAuthProvider(
      fakeConfig({ NODE_ENV: 'production', ALLOW_MOCK_LOGIN: 'false' }),
    );
    await expect(provider.authenticate({ code: 'x' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('AuthService.login("mock") 端到端签发 JWT（DB 层 mock）', () => {
  it('用 mock provider 走完整登录流程，拿到可解码的 JWT', async () => {
    const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '7d' } });

    // mock 出 DB 层：upsertByOpenid 返回一个用户，save 原样返回
    const savedUser: any = {
      id: 'user-1', openid: 'mock-alice', role: 'user',
      nickname: 'Dev User alice', avatar: null, lastLoginAt: null,
    };
    const usersMock: any = {
      upsertByExternalId: jest.fn().mockResolvedValue(savedUser),
      save: jest.fn().mockResolvedValue(savedUser),
    };

    const mockProvider = new MockAuthProvider(
      fakeConfig({ NODE_ENV: 'development', ALLOW_MOCK_LOGIN: 'true' }),
    );

    const service = new AuthService(usersMock, jwt, [mockProvider]);
    const res = await service.login('mock', { code: 'alice' });

    expect(typeof res.token).toBe('string');
    expect(res.token.length).toBeGreaterThan(20);

    const decoded = jwt.verify(res.token) as any;
    expect(decoded.sub).toBe('user-1');
    expect(decoded.openid).toBe('mock-alice');
    expect(decoded.role).toBe('user');

    expect(usersMock.upsertByExternalId).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'mock', externalId: 'mock-alice' }),
    );
    expect(res.user.id).toBe('user-1');
  });
});
