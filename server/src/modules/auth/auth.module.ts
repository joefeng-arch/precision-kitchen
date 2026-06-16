import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AUTH_PROVIDERS } from '../../common/interfaces/auth-provider.interface';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { WxAuthProvider } from './providers/wx-auth.provider';
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
    WxAuthProvider,
    // 添加新登录方式：
    //   AppleAuthProvider,
    //   GoogleAuthProvider,

    // 聚合所有 providers 为数组注入到 AuthService
    {
      provide: AUTH_PROVIDERS,
      useFactory: (...providers: InstanceType<any>[]) => providers,
      inject: [
        WxAuthProvider,
        // 新增 provider 时在此追加：
        // AppleAuthProvider,
        // GoogleAuthProvider,
      ],
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
