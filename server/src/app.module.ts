import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { databaseConfig } from './config/database.config';
import { redisConfig } from './config/redis.config';
import { jwtConfig } from './config/jwt.config';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContentModule } from './modules/content/content.module';
import { WxModule } from './modules/wx/wx.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CookingModule } from './modules/cooking/cooking.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { IngredientsModule } from './modules/ingredients/ingredients.module';
import { RecipesModule } from './modules/recipes/recipes.module';
import { TimersModule } from './modules/timers/timers.module';
import { MealPlansModule } from './modules/meal-plans/meal-plans.module';
import { ShareModule } from './modules/share/share.module';
import { ShoppingListModule } from './modules/shopping-list/shopping-list.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { UsersModule } from './modules/users/users.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [databaseConfig, redisConfig, jwtConfig],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT ?? '5432', 10),
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        migrationsTableName: 'typeorm_migrations',
        migrationsRun: false,
        synchronize: false,
        logging: process.env.NODE_ENV === 'development',
        retryAttempts: 5,
        retryDelay: 3000,
        autoLoadEntities: true,
        extra: {
          max: 10, // connection pool ceiling
          connectionTimeoutMillis: 10000,
        },
      }),
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => {
        const cacheLogger = new Logger('CacheRedis');
        const { redisStore } = await import('cache-manager-ioredis-yet');
        const store = await redisStore({
          host: process.env.REDIS_HOST ?? 'localhost',
          port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => {
            if (times > 10) return null;
            return Math.min(times * 200, 3000);
          },
          reconnectOnError: (err: Error) => err.message.includes('READONLY'),
          enableOfflineQueue: false,
          lazyConnect: true,
        });
        // Attach error handler to the underlying ioredis client to prevent unhandled error events
        const client = (store as any).client ?? (store as any).getClient?.();
        if (client && typeof client.on === 'function') {
          client.on('error', (err: Error) => {
            cacheLogger.error(`Redis error: ${err.message}`);
          });
          client.on('connect', () => {
            cacheLogger.log('Redis connected');
          });
        }
        return { store };
      },
    }),
    WxModule,
    AuthModule,
    UsersModule,
    ContentModule,
    CategoriesModule,
    IngredientsModule,
    RecipesModule,
    CookingModule,
    TimersModule,
    FavoritesModule,
    AdminModule,
    MealPlansModule,
    ShareModule,
    ShoppingListModule,
    UploadsModule,
  ],
})
export class AppModule {}
