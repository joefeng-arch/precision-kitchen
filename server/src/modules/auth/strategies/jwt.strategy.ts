import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtUserPayload } from '../../../common/decorators/current-user.decorator';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'change-me-in-production',
    });
  }

  async validate(payload: JwtUserPayload): Promise<JwtUserPayload> {
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User no longer exists');
    // 有效角色：vip 已过期折算为 user（只读折算，不写库——
    // RevenueCat webhook 的 EXPIRATION 事件才是存储角色的唯一写者）。
    // vipExpiresAt 为 null 的 vip = 永久 PRO（Lifetime/管理员授予）。
    const lapsed =
      user.role === 'vip' && user.vipExpiresAt != null && user.vipExpiresAt <= new Date();
    return {
      sub: user.id,
      openid: user.openid ?? undefined,
      role: lapsed ? 'user' : user.role,
    };
  }
}
