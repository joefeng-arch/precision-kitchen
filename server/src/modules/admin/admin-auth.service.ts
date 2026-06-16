import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { AdminUser } from './entities/admin-user.entity';

export interface AdminJwtPayload {
  sub: string;
  username: string;
  role: 'admin' | 'super_admin';
  /** Set automatically by JwtModule signOptions.audience */
  aud?: 'admin';
}

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    @InjectRepository(AdminUser)
    private readonly repo: Repository<AdminUser>,
    private readonly jwt: JwtService,
  ) {}

  async login(username: string, password: string) {
    const admin = await this.repo.findOne({ where: { username } });
    if (!admin) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // Update last login time
    admin.lastLoginAt = new Date();
    await this.repo.save(admin);

    const payload = {
      sub: admin.id,
      username: admin.username,
      role: admin.role,
    };

    const token = this.jwt.sign(payload);
    this.logger.log(`Admin login: ${admin.username}`);

    return {
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        nickname: admin.nickname,
        role: admin.role,
        mustChangePassword: admin.mustChangePassword,
      },
    };
  }

  async changePassword(adminId: string, currentPassword: string, newPassword: string): Promise<void> {
    const admin = await this.repo.findOne({ where: { id: adminId } });
    if (!admin) throw new UnauthorizedException('管理员不存在');

    const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!valid) throw new UnauthorizedException('当前密码不正确');

    if (newPassword.length < 8) {
      throw new BadRequestException('新密码不能少于 8 位');
    }
    if (newPassword === currentPassword) {
      throw new BadRequestException('新密码不能与当前密码相同');
    }

    admin.passwordHash = await bcrypt.hash(newPassword, 10);
    admin.mustChangePassword = false;
    await this.repo.save(admin);
    this.logger.log(`Admin password changed: ${admin.username}`);
  }

  async findById(id: string): Promise<AdminUser | null> {
    return this.repo.findOne({ where: { id } });
  }
}
