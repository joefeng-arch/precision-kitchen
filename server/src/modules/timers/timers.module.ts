import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { TimersController } from './timers.controller';
import { REDIS_CLIENT, TimersService } from './timers.service';

const logger = new Logger('TimersRedis');

@Module({
  controllers: [TimersController],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const client = new Redis({
          host: config.get<string>('REDIS_HOST') ?? 'localhost',
          port: parseInt(config.get<string>('REDIS_PORT') ?? '6379', 10),
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => {
            if (times > 10) return null; // give up after 10 retries
            return Math.min(times * 200, 3000); // exponential backoff, cap 3s
          },
          reconnectOnError: (err: Error) => err.message.includes('READONLY'),
          enableOfflineQueue: false,
          lazyConnect: true,
        });

        client.on('error', (err) => {
          logger.error(`Redis error: ${err.message}`);
        });

        client.on('connect', () => {
          logger.log('Redis connected');
        });

        // Explicitly connect (lazyConnect = true)
        client.connect().catch((err) => {
          logger.error(`Redis initial connect failed: ${err.message}`);
        });

        return client;
      },
    },
    TimersService,
  ],
  exports: [TimersService],
})
export class TimersModule {}
