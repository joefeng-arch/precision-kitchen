import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminMustChangePassword1779800000013 implements MigrationInterface {
  name = 'AddAdminMustChangePassword1779800000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "admin_users"
      ADD COLUMN IF NOT EXISTS "must_change_password" boolean NOT NULL DEFAULT true
    `);
    // 已存在的账号不强制改密（存量数据设为 false，避免锁住已在使用的管理员）
    await queryRunner.query(`
      UPDATE "admin_users" SET "must_change_password" = false WHERE "must_change_password" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "admin_users" DROP COLUMN IF EXISTS "must_change_password"
    `);
  }
}
