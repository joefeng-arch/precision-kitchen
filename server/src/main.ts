import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

/** 开发占位值列表——任何一个出现在生产环境都应拒绝启动 */
const DEV_SECRET_PLACEHOLDERS = [
  'your-jwt-secret-change-in-production',
  'admin-jwt-secret-change-in-production',
  'change-me',
  'change-me-use-64-random-hex-chars-in-production',
  'change-me-use-another-64-random-hex-chars',
];

function assertProductionSecrets(): void {
  const env = process.env.NODE_ENV;
  if (env !== 'production') return;

  const jwtSecret = process.env.JWT_SECRET ?? '';
  const adminSecret = process.env.ADMIN_JWT_SECRET ?? '';

  for (const placeholder of DEV_SECRET_PLACEHOLDERS) {
    if (jwtSecret === placeholder) {
      throw new Error(
        '🚨 生产环境拒绝启动：JWT_SECRET 仍为开发占位值。请运行：\n' +
          '   node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"\n' +
          '并将结果写入 .env.production 的 JWT_SECRET。',
      );
    }
    if (adminSecret === placeholder) {
      throw new Error(
        '🚨 生产环境拒绝启动：ADMIN_JWT_SECRET 仍为开发占位值。\n' +
          '请生成新的 64 字节随机字符串写入 ADMIN_JWT_SECRET。',
      );
    }
  }

  if (jwtSecret.length < 32) {
    throw new Error('🚨 生产环境拒绝启动：JWT_SECRET 长度不足 32 字符，安全风险过高。');
  }
  if (adminSecret.length < 32) {
    throw new Error('🚨 生产环境拒绝启动：ADMIN_JWT_SECRET 长度不足 32 字符，安全风险过高。');
  }
}

async function bootstrap() {
  // 生产环境强制校验 JWT Secret，占位值直接拒绝启动
  assertProductionSecrets();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  app.useStaticAssets(join(process.cwd(), uploadDir), { prefix: '/uploads/' });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);
  const env = config.get<string>('NODE_ENV', 'development');

  app.setGlobalPrefix('api');
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  if (env !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Uncle Joe's Kitchen API")
      .setDescription('老舅厨房 后端 API 文档')
      .setVersion('0.5.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api-docs', app, document);
    Logger.log(`📚 Swagger: http://localhost:${port}/api-docs`, 'Bootstrap');
  }

  await app.listen(port, '0.0.0.0');
  Logger.log(`🚀 Server running on http://0.0.0.0:${port}/api`, 'Bootstrap');
}

bootstrap();
