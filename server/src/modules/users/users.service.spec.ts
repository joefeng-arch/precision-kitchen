import { UsersService } from './users.service';
import { User } from './entities/user.entity';

/** 极简 Repository 替身，可逐用例配置 findOne / create / save 行为 */
function makeRepo(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    findOne: jest.fn(),
    create: jest.fn((x: any) => x),
    save: jest.fn((x: any) => Promise.resolve({ id: 'generated-id', ...x })),
    ...overrides,
  } as any;
}

describe('UsersService.upsertByExternalId', () => {
  it('新用户：未命中 → create 写入 provider/externalId，wechat 镜像 openid', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const svc = new UsersService(repo);

    await svc.upsertByExternalId({
      provider: 'wechat',
      externalId: 'wx-openid-123',
      nickname: '小明',
    });

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { provider: 'wechat', externalId: 'wx-openid-123' },
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'wechat',
        externalId: 'wx-openid-123',
        openid: 'wx-openid-123', // wechat 镜像
        nickname: '小明',
        role: 'user',
      }),
    );
  });

  it('非微信用户（mock）：openid 保持 null', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const svc = new UsersService(repo);

    await svc.upsertByExternalId({ provider: 'mock', externalId: 'mock-alice' });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'mock',
        externalId: 'mock-alice',
        openid: null,
      }),
    );
  });

  it('老用户：命中 → 只更新 nickname/avatar/unionid，不 create', async () => {
    const existing: Partial<User> = {
      id: 'u1',
      provider: 'mock',
      externalId: 'mock-alice',
      openid: null,
      nickname: '旧名',
      avatar: null,
      unionid: null,
    };
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(existing) });
    const svc = new UsersService(repo);

    await svc.upsertByExternalId({
      provider: 'mock',
      externalId: 'mock-alice',
      nickname: '新名',
    });

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1', nickname: '新名' }));
  });

  it('并发冲突 23505：回查返回已插入用户', async () => {
    const inserted: Partial<User> = { id: 'u2', provider: 'mock', externalId: 'mock-bob' };
    const findOne = jest
      .fn()
      .mockResolvedValueOnce(null) // upsert 首次查找：未命中
      .mockResolvedValueOnce(inserted); // 23505 后回查：命中
    const save = jest.fn().mockRejectedValue({ code: '23505' });
    const repo = makeRepo({ findOne, save });
    const svc = new UsersService(repo);

    const result = await svc.upsertByExternalId({
      provider: 'mock',
      externalId: 'mock-bob',
    });

    expect(result).toBe(inserted);
    expect(findOne).toHaveBeenCalledTimes(2);
  });
});

describe('UsersService.setTier — 订阅层级原语', () => {
  const baseUser = { id: 'u1', role: 'user', vipExpiresAt: null } as any;

  it("('vip', 未来时间) → role=vip + 过期时间落库", async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ ...baseUser }) });
    const svc = new UsersService(repo);
    const expiry = new Date('2027-01-01T00:00:00Z');

    await svc.setTier('u1', 'vip', expiry);

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'vip', vipExpiresAt: expiry }),
    );
  });

  it("('vip', null) → 永久 PRO（Lifetime 授予形态）", async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ ...baseUser }) });
    const svc = new UsersService(repo);

    await svc.setTier('u1', 'vip', null);

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'vip', vipExpiresAt: null }),
    );
  });

  it("('user', null) → 降级清空", async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ ...baseUser, role: 'vip', vipExpiresAt: new Date() }),
    });
    const svc = new UsersService(repo);

    await svc.setTier('u1', 'user', null);

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'user', vipExpiresAt: null }),
    );
  });

  it("('user', 传了时间) → vipExpiresAt 强制置 null（降级不留残余）", async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ ...baseUser }) });
    const svc = new UsersService(repo);

    await svc.setTier('u1', 'user', new Date('2027-01-01'));

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'user', vipExpiresAt: null }),
    );
  });

  it('用户不存在 → NotFoundException', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const svc = new UsersService(repo);

    await expect(svc.setTier('missing', 'vip', null)).rejects.toThrow('User not found');
  });
});
