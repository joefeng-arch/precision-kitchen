import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Recipe ↔ Category 多对多关联表。
 * 故意没用 @ManyToMany 装饰器：保持简单显式，写入逻辑直接操作这张表。
 * 一个菜谱可以归到多个分类（中餐 + 家常菜 + 我的最爱）。
 */
@Entity('recipe_categories')
@Index(['recipeId', 'categoryId'], { unique: true })
@Index(['categoryId'])
export class RecipeCategory {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  recipeId!: string;

  @Column({ type: 'int' })
  categoryId!: number;
}
