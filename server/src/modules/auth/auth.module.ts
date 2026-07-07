import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AUTH_PROVIDERS } from '../../common/interfaces/auth-provider.interface';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AppleAuthProvider } from './providers/apple-auth.provider';
import { GoogleAuthProvider } from './providers/google-auth.provider';
import { MockAuthProvider } from './providers/mock-auth.provider';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'change-me-in-production',
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '7d',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,

    // ── Auth Providers ──────────────────────────────────────
    // 每个 provider 先作为普通 class 注册（NestJS 管理其生命周期）
    MockAuthProvider, // 本地 dev 登录，受 ALLOW_MOCK_LOGIN 控制
    AppleAuthProvider, // Apple 登录，校验 identityToken（APPLE_CLIENT_ID）
    GoogleAuthProvider, // Google 登录，校验 idToken（GOOGLE_*_CLIENT_ID）

    // 聚合所有 providers 为数组注入到 AuthService
    {
      provide: AUTH_PROVIDERS,
      useFactory: (...providers: InstanceType<any>[]) => providers,
      inject: [
        MockAuthProvider,
        AppleAuthProvider,
        GoogleAuthProvider,
        // 新增 provider 时在此追加
      ],
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
