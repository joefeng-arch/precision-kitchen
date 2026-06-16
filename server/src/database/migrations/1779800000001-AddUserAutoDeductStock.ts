import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserAutoDeductStock1779800000001 implements MigrationInterface {
  name = 'AddUserAutoDeductStock1779800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "autoDeductStock" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "autoDeductStock"`,
    );
  }
}
