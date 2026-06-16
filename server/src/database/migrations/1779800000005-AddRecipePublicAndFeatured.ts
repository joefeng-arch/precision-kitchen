import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRecipePublicAndFeatured1779800000005 implements MigrationInterface {
  name = 'AddRecipePublicAndFeatured1779800000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "isPublic" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "isFeatured" boolean NOT NULL DEFAULT false`,
    );
    // published recipes created before this migration should be public
    await queryRunner.query(
      `UPDATE "recipes" SET "isPublic" = true WHERE "status" = 'published'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "recipes" DROP COLUMN IF EXISTS "isFeatured"`);
    await queryRunner.query(`ALTER TABLE "recipes" DROP COLUMN IF EXISTS "isPublic"`);
  }
}
