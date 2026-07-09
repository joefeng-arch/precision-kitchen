import { DataSource } from 'typeorm';
import { Category, CategoryType } from '../../modules/categories/entities/category.entity';

const RECIPE = [
  '中餐',
  '西餐',
  '日料',
  '韩餐',
  '东南亚菜',
  '烘焙',
  '甜点',
  '饮品',
  '轻食',
  '火锅',
  '烧烤',
  '家常菜',
  '下饭菜',
  '快手菜',
];
const INGREDIENT = [
  '蔬菜',
  '水果',
  '肉禽',
  '海鲜水产',
  '蛋奶',
  '豆制品',
  '粮油',
  '调味品',
  '干货',
  '香料',
  '烘焙原料',
];
const MEAL_SCENE = ['早餐', '午餐', '晚餐', '下午茶', '夜宵', '聚餐'];

export async function seedCategories(ds: DataSource): Promise<void> {
  const repo = ds.getRepository(Category);
  const groups: Array<[CategoryType, string[]]> = [
    ['recipe', RECIPE],
    ['ingredient', INGREDIENT],
    ['meal_scene', MEAL_SCENE],
  ];

  let inserted = 0;
  let skipped = 0;
  for (const [type, names] of groups) {
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const exists = await repo.findOne({ where: { type, name } });
      if (exists) {
        skipped++;
        continue;
      }
      await repo.save(repo.create({ type, name, sort: i * 10 }));
      inserted++;
    }
  }
  console.log(`[seed:categories] inserted=${inserted} skipped=${skipped}`);
}
