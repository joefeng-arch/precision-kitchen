import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'ujk_user',
  password: process.env.DB_PASSWORD ?? 'ujk_dev_password',
  database: process.env.DB_NAME ?? 'ujk_dev',
}));
