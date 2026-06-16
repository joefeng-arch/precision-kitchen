import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdminUsers1779800000008 implements MigrationInterface {
  name = 'CreateAdminUsers1779800000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username       VARCHAR(64) UNIQUE NOT NULL,
        password_hash  VARCHAR(255) NOT NULL,
        nickname       VARCHAR(64),
        email          VARCHAR(128),
        role           VARCHAR(20) NOT NULL DEFAULT 'admin',
        last_login_at  TIMESTAMPTZ,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS admin_users;`);
  }
}
