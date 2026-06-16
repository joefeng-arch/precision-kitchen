import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

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

  async upsertByOpenid(input: {
    openid: string;
    unionid?: string | null;
    nickname?: string;
    avatar?: string | null;
  }): Promise<User> {
    const existing = await this.findByOpenid(input.openid);
    if (existing) {
      if (input.unionid !== undefined) existing.unionid = input.unionid;
      if (input.nickname) existing.nickname = input.nickname;
      if (input.avatar !== undefined) existing.avatar = input.avatar;
      return this.repo.save(existing);
    }
    try {
      const user = this.repo.create({
        openid: input.openid,
        unionid: input.unionid ?? null,
        nickname: input.nickname ?? '吃货',
        avatar: input.avatar ?? null,
        role: 'user',
      });
      return await this.repo.save(user);
    } catch (err: any) {
      // 并发竞争：另一个请求已插入，回查返回
      if (err?.code === '23505') {
        const u = await this.findByOpenid(input.openid);
        if (u) return u;
      }
      throw err;
    }
  }

  save(user: User): Promise<User> {
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
