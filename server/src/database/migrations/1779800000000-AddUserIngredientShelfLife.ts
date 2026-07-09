import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserIngredientShelfLife1779800000000 implements MigrationInterface {
  name = 'AddUserIngredientShelfLife1779800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_ingredients" ADD COLUMN IF NOT EXISTS "expiryDate" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_ingredients" ADD COLUMN IF NOT EXISTS "storageType" varchar(16)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_ingredients" DROP COLUMN IF EXISTS "storageType"`);
    await queryRunner.query(`ALTER TABLE "user_ingredients" DROP COLUMN IF EXISTS "expiryDate"`);
  }
}
