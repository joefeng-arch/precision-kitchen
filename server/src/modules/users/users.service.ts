import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByIdOrFail(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  findByOpenid(openid: string): Promise<User | null> {
    return this.repo.findOne({ where: { openid } });
  }

  findByExternalId(provider: string, externalId: string): Promise<User | null> {
    return this.repo.findOne({ where: { provider, externalId } });
  }

  /**
   * 按 (provider, externalId) 复合键 upsert 用户。
   * 微信用户额外镜像写 openid = externalId，保持 JWT/seed/admin 里读 openid 的逻辑兼容；
   * 非微信用户 openid 保持 null。
   */
  async upsertByExternalId(input: {
    provider: string;
    externalId: string;
    unionid?: string | null;
    nickname?: string;
    avatar?: string | null;
  }): Promise<User> {
    const existing = await this.findByExternalId(input.provider, input.externalId);
    if (existing) {
      if (input.unionid !== undefined) existing.unionid = input.unionid;
      if (input.nickname) existing.nickname = input.nickname;
      if (input.avatar !== undefined) existing.avatar = input.avatar;
      return this.repo.save(existing);
    }
    try {
      const user = this.repo.create({
        provider: input.provider,
        externalId: input.externalId,
        // 向后兼容：仅微信用户镜像 openid，其余保持 null
        openid: input.provider === 'wechat' ? input.externalId : null,
        unionid: input.unionid ?? null,
        nickname: input.nickname ?? '吃货',
        avatar: input.avatar ?? null,
        role: 'user',
      });
      return await this.repo.save(user);
    } catch (err: any) {
      // 并发竞争：另一个请求已插入，回查返回
      if (err?.code === '23505') {
        const u = await this.findByExternalId(input.provider, input.externalId);
        if (u) return u;
      }
      throw err;
    }
  }

  save(user: User): Promise<User> {
    return this.repo.save(user);
  }

  /**
   * 订阅层级原语：admin setVip / RevenueCat webhook / mock dev 端点共用。
   * ('vip', date) = 订阅至 date；('vip', null) = 永久 PRO（Lifetime 授予形态）；
   * ('user', 任意) = 降级并清空过期时间。
   */
  async setTier(id: string, tier: UserRole, vipExpiresAt: Date | null): Promise<User> {
    const user = await this.findByIdOrFail(id);
    user.role = tier;
    user.vipExpiresAt = tier === 'vip' ? vipExpiresAt : null;
    return this.repo.save(user);
  }

  async updateProfile(
    id: string,
    patch: { nickname?: string; avatar?: string | null; autoDeductStock?: boolean },
  ): Promise<User> {
    const user = await this.findByIdOrFail(id);
    if (patch.nickname !== undefined) user.nickname = patch.nickname;
    if (patch.avatar !== undefined) user.avatar = patch.avatar;
    if (patch.autoDeductStock !== undefined) user.autoDeductStock = patch.autoDeductStock;
    return this.repo.save(user);
  }
}
