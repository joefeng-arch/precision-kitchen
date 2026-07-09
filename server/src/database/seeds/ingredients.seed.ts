import { DataSource } from 'typeorm';
import { Category } from '../../modules/categories/entities/category.entity';
import { Ingredient } from '../../modules/ingredients/entities/ingredient.entity';

type ScaleType = 'linear' | 'sub_linear' | 'fixed';

interface SeedItem {
  name: string;
  category: string;
  defaultUnit: string;
  referencePrice: number;
  referenceUnit: string;
  defaultScaleType: ScaleType;
}

const DATA: SeedItem[] = [
  // 蔬菜
  {
    name: '白菜',
    category: '蔬菜',
    defaultUnit: 'g',
    referencePrice: 3,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '青菜',
    category: '蔬菜',
    defaultUnit: 'g',
    referencePrice: 4,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '土豆',
    category: '蔬菜',
    defaultUnit: 'g',
    referencePrice: 3,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '番茄',
    category: '蔬菜',
    defaultUnit: 'g',
    referencePrice: 5,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '黄瓜',
    category: '蔬菜',
    defaultUnit: 'g',
    referencePrice: 4,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '洋葱',
    category: '蔬菜',
    defaultUnit: 'g',
    referencePrice: 3,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '胡萝卜',
    category: '蔬菜',
    defaultUnit: 'g',
    referencePrice: 3,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '西兰花',
    category: '蔬菜',
    defaultUnit: 'g',
    referencePrice: 8,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '茄子',
    category: '蔬菜',
    defaultUnit: 'g',
    referencePrice: 5,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '辣椒',
    category: '蔬菜',
    defaultUnit: 'g',
    referencePrice: 8,
    referenceUnit: '斤',
    defaultScaleType: 'sub_linear',
  },

  // 水果
  {
    name: '苹果',
    category: '水果',
    defaultUnit: 'g',
    referencePrice: 8,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '香蕉',
    category: '水果',
    defaultUnit: 'g',
    referencePrice: 5,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '柠檬',
    category: '水果',
    defaultUnit: '个',
    referencePrice: 2.5,
    referenceUnit: '个',
    defaultScaleType: 'sub_linear',
  },

  // 肉禽
  {
    name: '猪肉',
    category: '肉禽',
    defaultUnit: 'g',
    referencePrice: 25,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '猪里脊',
    category: '肉禽',
    defaultUnit: 'g',
    referencePrice: 35,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '五花肉',
    category: '肉禽',
    defaultUnit: 'g',
    referencePrice: 30,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '牛肉',
    category: '肉禽',
    defaultUnit: 'g',
    referencePrice: 60,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '鸡腿',
    category: '肉禽',
    defaultUnit: 'g',
    referencePrice: 12,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '鸡胸肉',
    category: '肉禽',
    defaultUnit: 'g',
    referencePrice: 15,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '鸡翅',
    category: '肉禽',
    defaultUnit: 'g',
    referencePrice: 22,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '羊肉',
    category: '肉禽',
    defaultUnit: 'g',
    referencePrice: 55,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },

  // 海鲜水产
  {
    name: '虾',
    category: '海鲜水产',
    defaultUnit: 'g',
    referencePrice: 40,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '鲈鱼',
    category: '海鲜水产',
    defaultUnit: 'g',
    referencePrice: 28,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '三文鱼',
    category: '海鲜水产',
    defaultUnit: 'g',
    referencePrice: 80,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },

  // 蛋奶
  {
    name: '鸡蛋',
    category: '蛋奶',
    defaultUnit: '个',
    referencePrice: 1.2,
    referenceUnit: '个',
    defaultScaleType: 'linear',
  },
  {
    name: '牛奶',
    category: '蛋奶',
    defaultUnit: 'ml',
    referencePrice: 12,
    referenceUnit: '升',
    defaultScaleType: 'linear',
  },
  {
    name: '黄油',
    category: '蛋奶',
    defaultUnit: 'g',
    referencePrice: 80,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '奶酪',
    category: '蛋奶',
    defaultUnit: 'g',
    referencePrice: 100,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },

  // 豆制品
  {
    name: '豆腐',
    category: '豆制品',
    defaultUnit: 'g',
    referencePrice: 4,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '豆干',
    category: '豆制品',
    defaultUnit: 'g',
    referencePrice: 10,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },

  // 粮油
  {
    name: '大米',
    category: '粮油',
    defaultUnit: 'g',
    referencePrice: 4,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '面粉',
    category: '粮油',
    defaultUnit: 'g',
    referencePrice: 3,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '食用油',
    category: '粮油',
    defaultUnit: 'ml',
    referencePrice: 20,
    referenceUnit: '升',
    defaultScaleType: 'linear',
  },
  {
    name: '香油',
    category: '粮油',
    defaultUnit: 'ml',
    referencePrice: 40,
    referenceUnit: '升',
    defaultScaleType: 'sub_linear',
  },

  // 调味品
  {
    name: '盐',
    category: '调味品',
    defaultUnit: 'g',
    referencePrice: 4,
    referenceUnit: '斤',
    defaultScaleType: 'sub_linear',
  },
  {
    name: '糖',
    category: '调味品',
    defaultUnit: 'g',
    referencePrice: 6,
    referenceUnit: '斤',
    defaultScaleType: 'sub_linear',
  },
  {
    name: '生抽',
    category: '调味品',
    defaultUnit: 'ml',
    referencePrice: 15,
    referenceUnit: '升',
    defaultScaleType: 'sub_linear',
  },
  {
    name: '老抽',
    category: '调味品',
    defaultUnit: 'ml',
    referencePrice: 15,
    referenceUnit: '升',
    defaultScaleType: 'sub_linear',
  },
  {
    name: '醋',
    category: '调味品',
    defaultUnit: 'ml',
    referencePrice: 10,
    referenceUnit: '升',
    defaultScaleType: 'sub_linear',
  },
  {
    name: '料酒',
    category: '调味品',
    defaultUnit: 'ml',
    referencePrice: 12,
    referenceUnit: '升',
    defaultScaleType: 'sub_linear',
  },
  {
    name: '蚝油',
    category: '调味品',
    defaultUnit: 'g',
    referencePrice: 18,
    referenceUnit: '斤',
    defaultScaleType: 'sub_linear',
  },
  {
    name: '味精',
    category: '调味品',
    defaultUnit: 'g',
    referencePrice: 10,
    referenceUnit: '斤',
    defaultScaleType: 'sub_linear',
  },
  {
    name: '鸡精',
    category: '调味品',
    defaultUnit: 'g',
    referencePrice: 15,
    referenceUnit: '斤',
    defaultScaleType: 'sub_linear',
  },
  {
    name: '白胡椒粉',
    category: '调味品',
    defaultUnit: 'g',
    referencePrice: 40,
    referenceUnit: '斤',
    defaultScaleType: 'sub_linear',
  },

  // 干货
  {
    name: '干香菇',
    category: '干货',
    defaultUnit: 'g',
    referencePrice: 60,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
  {
    name: '木耳',
    category: '干货',
    defaultUnit: 'g',
    referencePrice: 40,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },

  // 香料
  {
    name: '葱',
    category: '香料',
    defaultUnit: 'g',
    referencePrice: 5,
    referenceUnit: '斤',
    defaultScaleType: 'fixed',
  },
  {
    name: '姜',
    category: '香料',
    defaultUnit: 'g',
    referencePrice: 8,
    referenceUnit: '斤',
    defaultScaleType: 'fixed',
  },
  {
    name: '蒜',
    category: '香料',
    defaultUnit: '瓣',
    referencePrice: 0.2,
    referenceUnit: '瓣',
    defaultScaleType: 'fixed',
  },
  {
    name: '八角',
    category: '香料',
    defaultUnit: 'g',
    referencePrice: 50,
    referenceUnit: '斤',
    defaultScaleType: 'fixed',
  },
  {
    name: '花椒',
    category: '香料',
    defaultUnit: 'g',
    referencePrice: 60,
    referenceUnit: '斤',
    defaultScaleType: 'sub_linear',
  },
  {
    name: '香叶',
    category: '香料',
    defaultUnit: 'g',
    referencePrice: 40,
    referenceUnit: '斤',
    defaultScaleType: 'fixed',
  },

  // 烘焙原料
  {
    name: '酵母',
    category: '烘焙原料',
    defaultUnit: 'g',
    referencePrice: 80,
    referenceUnit: '斤',
    defaultScaleType: 'sub_linear',
  },
  {
    name: '泡打粉',
    category: '烘焙原料',
    defaultUnit: 'g',
    referencePrice: 30,
    referenceUnit: '斤',
    defaultScaleType: 'sub_linear',
  },
  {
    name: '可可粉',
    category: '烘焙原料',
    defaultUnit: 'g',
    referencePrice: 80,
    referenceUnit: '斤',
    defaultScaleType: 'linear',
  },
];

export async function seedIngredients(ds: DataSource): Promise<void> {
  const ingRepo = ds.getRepository(Ingredient);
  const catRepo = ds.getRepository(Category);

  const cats = await catRepo.find({ where: { type: 'ingredient' } });
  const catMap = new Map(cats.map((c) => [c.name, c.id]));

  let inserted = 0;
  let skipped = 0;
  for (let i = 0; i < DATA.length; i++) {
    const item = DATA[i];
    const exists = await ingRepo.findOne({ where: { name: item.name } });
    if (exists) {
      skipped++;
      continue;
    }
    await ingRepo.save(
      ingRepo.create({
        name: item.name,
        categoryId: catMap.get(item.category) ?? null,
        defaultUnit: item.defaultUnit,
        referencePrice: item.referencePrice.toFixed(2),
        referenceUnit: item.referenceUnit,
        defaultScaleType: item.defaultScaleType,
        sort: i * 10,
      }),
    );
    inserted++;
  }
  console.log(`[seed:ingredients] inserted=${inserted} skipped=${skipped}`);
}
