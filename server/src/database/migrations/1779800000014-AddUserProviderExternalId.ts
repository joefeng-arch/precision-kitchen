import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 泛化用户身份键：openid → (provider, externalId)。
 * 增量加列、回填存量微信用户、加复合唯一索引。保留 openid 列与其索引不动。
 */
export class AddUserProviderExternalId1779800000014 implements MigrationInterface {
  name = 'AddUserProviderExternalId1779800000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "provider" varchar(16)`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "externalId" varchar(128)`,
    );
    // 回填：存量微信用户 openid → (wechat, openid)，保持身份连续
    await queryRunner.query(
      `UPDATE "users" SET "provider" = 'wechat', "externalId" = "openid"
       WHERE "openid" IS NOT NULL AND "externalId" IS NULL`,
    );
    // 复合唯一索引；Postgres 视多个 NULL 互不相同，官方/未迁移用户共存无冲突
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_provider_externalId"
       ON "users" ("provider", "externalId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_provider_externalId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "externalId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "provider"`);
  }
}
