import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AdminAuthService, AdminJwtPayload } from '../admin-auth.service';

/**
 * Separate Passport strategy for admin JWTs.
 * Uses a different secret (ADMIN_JWT_SECRET) and validates against admin_users table.
 * Strategy name: 'admin-jwt' (distinct from 'jwt' used by mini-app users).
 */
@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    config: ConfigService,
    private readonly adminAuth: AdminAuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('ADMIN_JWT_SECRET') ?? 'admin-change-me-in-production',
      audience: 'admin',
    });
  }

  async validate(payload: AdminJwtPayload): Promise<AdminJwtPayload> {
    if (payload.aud !== 'admin') {
      throw new UnauthorizedException('Invalid token audience');
    }
    const admin = await this.adminAuth.findById(payload.sub);
    if (!admin) {
      throw new UnauthorizedException('Admin account no longer exists');
    }
    return {
      sub: admin.id,
      username: admin.username,
      role: admin.role,
      aud: 'admin',
    };
  }
}
