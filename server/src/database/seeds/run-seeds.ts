import 'dotenv/config';
import { DataSource } from 'typeorm';
import { AdminUser } from '../../modules/admin/entities/admin-user.entity';
import { Category } from '../../modules/categories/entities/category.entity';
import { Ingredient } from '../../modules/ingredients/entities/ingredient.entity';
import { UserIngredient } from '../../modules/ingredients/entities/user-ingredient.entity';
import { Recipe } from '../../modules/recipes/entities/recipe.entity';
import { RecipeCategory } from '../../modules/recipes/entities/recipe-category.entity';
import { RecipeIngredient } from '../../modules/recipes/entities/recipe-ingredient.entity';
import { RecipeStep } from '../../modules/recipes/entities/recipe-step.entity';
import { User } from '../../modules/users/entities/user.entity';
import { seedAdmin } from './admin.seed';
import { seedCategories } from './categories.seed';
import { seedIngredients } from './ingredients.seed';
import { seedRecipes } from './recipes.seed';

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USER ?? 'ujk_user',
    password: process.env.DB_PASSWORD ?? 'ujk_dev_password',
    database: process.env.DB_NAME ?? 'ujk_dev',
    entities: [AdminUser, Category, Ingredient, UserIngredient, Recipe, RecipeCategory, RecipeIngredient, RecipeStep, User],
    synchronize: false,
  });

  await ds.initialize();
  console.log('[seed] db connected');

  try {
    await seedCategories(ds);
    await seedIngredients(ds);
    await seedAdmin(ds);
    await seedRecipes(ds);
    console.log('[seed] done');
  } catch (err) {
    console.error('[seed] failed', err);
    process.exitCode = 1;
  } finally {
    await ds.destroy();
  }
}

main();
