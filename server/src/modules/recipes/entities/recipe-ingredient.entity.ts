import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
} from 'typeorm';
import { Recipe } from './recipe.entity';

export type ScaleType = 'linear' | 'sub_linear' | 'fixed';

@Entity('recipe_ingredients')
@Index(['recipeId'])
export class RecipeIngredient {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  recipeId!: string;

  @ManyToOne(() => Recipe, (r) => r.ingredients, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipeId' })
  recipe!: Recipe;

  @Column({ type: 'int', nullable: true })
  ingredientId!: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  customName!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 16 })
  unit!: string;

  @Column({ type: 'varchar', length: 16, default: 'linear' })
  scaleType!: ScaleType;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 0.7 })
  scaleFactor!: string;

  @Column({ type: 'varchar', length: 32, nullable: true, comment: '分组：主料/腌料/调味' })
  groupName!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  notes!: string | null;

  @Column({ type: 'int', default: 0 })
  sort!: number;
}
