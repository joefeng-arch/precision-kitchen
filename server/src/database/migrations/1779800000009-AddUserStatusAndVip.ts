import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserStatusAndVip1779800000009 implements MigrationInterface {
  name = 'AddUserStatusAndVip1779800000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS "vipExpiresAt" TIMESTAMPTZ;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_status;`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS "vipExpiresAt";`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS status;`);
  }
}
