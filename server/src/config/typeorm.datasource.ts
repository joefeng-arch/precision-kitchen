import 'dotenv/config';
import { DataSource } from 'typeorm';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'ujk_user',
  password: process.env.DB_PASSWORD ?? 'ujk_dev_password',
  database: process.env.DB_NAME ?? 'ujk_dev',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  extra: {
    max: 10,
    connectionTimeoutMillis: 10000,
  },
});

export default AppDataSource;
