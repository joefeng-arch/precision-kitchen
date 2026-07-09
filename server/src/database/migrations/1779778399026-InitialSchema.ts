import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1779778399026 implements MigrationInterface {
  name = 'InitialSchema1779778399026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "openid" varchar(64),
        "unionid" varchar(64),
        "nickname" varchar(64) NOT NULL DEFAULT 'foodie',
        "avatar" varchar(512),
        "role" varchar(16) NOT NULL DEFAULT 'user',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_openid" ON "users" ("openid")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "categories" (
        "id" SERIAL PRIMARY KEY,
        "type" varchar(16) NOT NULL,
        "name" varchar(32) NOT NULL,
        "icon" varchar(32),
        "sort" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_categories_type_name" ON "categories" ("type", "name")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ingredients" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar(64) NOT NULL,
        "categoryId" integer,
        "defaultUnit" varchar(16) NOT NULL DEFAULT 'g',
        "referencePrice" numeric(10,2),
        "referenceUnit" varchar(16),
        "imageUrl" varchar(512),
        "defaultScaleType" varchar(16) NOT NULL DEFAULT 'linear',
        "sort" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ingredients_name" ON "ingredients" ("name")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recipes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "authorId" uuid NOT NULL,
        "title" varchar(128) NOT NULL,
        "description" text,
        "coverImage" varchar(512),
        "categoryId" integer,
        "mealSceneId" integer,
        "baseServings" integer NOT NULL DEFAULT 2,
        "difficulty" varchar(16) NOT NULL DEFAULT 'medium',
        "totalMinutes" integer,
        "status" varchar(16) NOT NULL DEFAULT 'draft',
        "tags" jsonb NOT NULL DEFAULT '[]',
        "versionCount" integer NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_recipes_authorId" ON "recipes" ("authorId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_recipes_status" ON "recipes" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_recipes_categoryId" ON "recipes" ("categoryId")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recipe_ingredients" (
        "id" SERIAL PRIMARY KEY,
        "recipeId" uuid NOT NULL,
        "ingredientId" integer,
        "customName" varchar(64),
        "amount" numeric(10,2) NOT NULL,
        "unit" varchar(16) NOT NULL,
        "scaleType" varchar(16) NOT NULL DEFAULT 'linear',
        "scaleFactor" numeric(4,2) NOT NULL DEFAULT '0.70',
        "groupName" varchar(32),
        "notes" varchar(128),
        "sort" integer NOT NULL DEFAULT 0,
        CONSTRAINT "FK_recipe_ingredients_recipe" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_recipe_ingredients_recipeId" ON "recipe_ingredients" ("recipeId")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recipe_steps" (
        "id" SERIAL PRIMARY KEY,
        "recipeId" uuid NOT NULL,
        "stepNumber" integer NOT NULL,
        "description" text NOT NULL,
        "imageUrl" varchar(512),
        "durationSeconds" integer,
        "tips" varchar(256),
        CONSTRAINT "FK_recipe_steps_recipe" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_recipe_steps_recipeId" ON "recipe_steps" ("recipeId")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "recipe_versions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "recipeId" uuid NOT NULL,
        "versionNumber" integer NOT NULL,
        "editorId" uuid NOT NULL,
        "snapshot" jsonb NOT NULL,
        "changeNote" varchar(256),
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_recipe_versions_recipeId_versionNumber" ON "recipe_versions" ("recipeId", "versionNumber")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_ingredients" (
        "id" SERIAL PRIMARY KEY,
        "userId" uuid NOT NULL,
        "ingredientId" integer,
        "customName" varchar(64),
        "unitPrice" numeric(10,2) NOT NULL,
        "priceUnit" varchar(16) NOT NULL,
        "stockAmount" numeric(10,2),
        "stockUnit" varchar(16),
        "notes" varchar(256),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_ingredients_userId_ingredientId" ON "user_ingredients" ("userId", "ingredientId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_ingredients_userId_customName" ON "user_ingredients" ("userId", "customName")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "favorites" (
        "id" SERIAL PRIMARY KEY,
        "userId" uuid NOT NULL,
        "recipeId" uuid NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_favorites_userId_recipeId" ON "favorites" ("userId", "recipeId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_favorites_userId" ON "favorites" ("userId")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cooking_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "recipeId" uuid NOT NULL,
        "recipeTitle" varchar(128) NOT NULL,
        "servings" numeric(6,2) NOT NULL,
        "durationMinutes" integer,
        "rating" integer,
        "notes" varchar(512),
        "totalCost" numeric(10,2) NOT NULL DEFAULT '0.00',
        "currency" varchar(16) NOT NULL DEFAULT 'CNY',
        "cookedAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cooking_logs_userId_cookedAt" ON "cooking_logs" ("userId", "cookedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cooking_logs_recipeId" ON "cooking_logs" ("recipeId")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cooking_log_costs" (
        "id" SERIAL PRIMARY KEY,
        "logId" uuid NOT NULL,
        "ingredientId" integer,
        "name" varchar(64) NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "unit" varchar(16) NOT NULL,
        "unitPrice" numeric(10,4),
        "priceUnit" varchar(16),
        "totalCost" numeric(10,2) NOT NULL DEFAULT '0.00',
        "source" varchar(16) NOT NULL DEFAULT 'unknown',
        CONSTRAINT "FK_cooking_log_costs_log" FOREIGN KEY ("logId") REFERENCES "cooking_logs"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cooking_log_costs_logId" ON "cooking_log_costs" ("logId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cooking_log_costs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cooking_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "favorites"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_ingredients"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "recipe_versions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "recipe_steps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "recipe_ingredients"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "recipes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ingredients"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
