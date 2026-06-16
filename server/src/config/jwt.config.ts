import { registerAs } from '@nestjs/config';

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET ?? 'change-me-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  adminSecret: process.env.ADMIN_JWT_SECRET ?? 'admin-change-me-in-production',
  adminExpiresIn: process.env.ADMIN_JWT_EXPIRES_IN ?? '12h',
}));
