import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

/** 极简 ConfigService 替身 */
function fakeConfig(values: Record<string, string> = {}): ConfigService {
  return {
    get: (key: string, def?: string) => values[key] ?? def,
  } as unknown as ConfigService;
}

function makeStrategy(user: unknown) {
  const users: any = {
    findById: jest.fn().mockResolvedValue(user),
    // 无 save/update：过期判断绝不写库（用例 4 依赖此形状断言）
  };
  const strategy = new JwtStrategy(fakeConfig({ JWT_SECRET: 'test' }), users);
  return { strategy, users };
}

const PAYLOAD = { sub: 'u1', role: 'user' as const };

describe('JwtStrategy.validate — 有效角色（vip 过期折算）', () => {
  it('用户已不存在 → UnauthorizedException', async () => {
    const { strategy } = makeStrategy(null);
    await expect(strategy.validate(PAYLOAD)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('普通用户 → role user', async () => {
    const { strategy } = makeStrategy({ id: 'u1', openid: null, role: 'user', vipExpiresAt: null });
    const out = await strategy.validate(PAYLOAD);
    expect(out.role).toBe('user');
  });

  it('vip 未过期 → role vip', async () => {
    const { strategy } = makeStrategy({
      id: 'u1',
      openid: null,
      role: 'vip',
      vipExpiresAt: new Date(Date.now() + 86400_000),
    });
    const out = await strategy.validate(PAYLOAD);
    expect(out.role).toBe('vip');
  });

  it('vip 已过期 → 有效角色折算为 user，且零 DB 写（webhook 是唯一写者）', async () => {
    const { strategy, users } = makeStrategy({
      id: 'u1',
      openid: null,
      role: 'vip',
      vipExpiresAt: new Date(Date.now() - 86400_000),
    });
    const out = await strategy.validate(PAYLOAD);
    expect(out.role).toBe('user');
    // 假件上只有 findById——validate 若尝试写库会直接 TypeError，
    // 这里再显式断言没有其他交互面被调用
    expect(Object.keys(users)).toEqual(['findById']);
  });

  it('vip + vipExpiresAt null → 永久 PRO，role vip', async () => {
    const { strategy } = makeStrategy({ id: 'u1', openid: null, role: 'vip', vipExpiresAt: null });
    const out = await strategy.validate(PAYLOAD);
    expect(out.role).toBe('vip');
  });
});
