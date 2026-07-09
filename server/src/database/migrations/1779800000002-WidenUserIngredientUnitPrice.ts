import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * canonical 单位下单价常常是 0.0252/g 这种小数，需要 4 位精度。
 * 原先 decimal(10,2) 会被截成 0.03，扣库存成本算不准。
 */
export class WidenUserIngredientUnitPrice1779800000002 implements MigrationInterface {
  name = 'WidenUserIngredientUnitPrice1779800000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_ingredients" ALTER COLUMN "unitPrice" TYPE numeric(12, 4)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_ingredients" ALTER COLUMN "unitPrice" TYPE numeric(10, 2)`,
    );
  }
}
