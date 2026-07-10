import { DataSource } from 'typeorm';
import { Category } from '../../modules/categories/entities/category.entity';

/**
 * 海外版原料库预设品类（PRD-overseas §4.6：烘焙料台 / 咖啡豆仓 / 酒柜）。
 * 命名待最终确认——只改这一处即可。与国内中文预设并存（(type,ownerId,name) 唯一，互不冲突）。
 */
export const OVERSEAS_PANTRY_CATEGORIES = ['Baking Bench', 'Bean Vault', 'Bar Cabinet'] as const;

export async function seedOverseasPantryCategories(ds: DataSource): Promise<void> {
  const repo = ds.getRepository(Category);

  let inserted = 0;
  let skipped = 0;
  for (let i = 0; i < OVERSEAS_PANTRY_CATEGORIES.length; i++) {
    const name = OVERSEAS_PANTRY_CATEGORIES[i];
    const exists = await repo.findOne({ where: { type: 'ingredient', name } });
    if (exists) {
      skipped++;
      continue;
    }
    // sort 排在国内预设（0..100）之前，海外 app 的分组/选择器优先展示
    await repo.save(repo.create({ type: 'ingredient', name, sort: -30 + i * 10 }));
    inserted++;
  }
  console.log(`[seed:overseas-pantry-categories] inserted=${inserted} skipped=${skipped}`);
}
