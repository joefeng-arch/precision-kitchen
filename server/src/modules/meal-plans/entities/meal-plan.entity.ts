import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Recipe } from '../../recipes/entities/recipe.entity';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

@Entity('meal_plans')
@Unique(['userId', 'planDate', 'mealType', 'recipeId'])
@Index(['userId', 'planDate'])
export class MealPlan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'date' })
  planDate!: string;

  @Column({ type: 'varchar', length: 20 })
  mealType!: MealType;

  @Column({ type: 'uuid' })
  recipeId!: string;

  @ManyToOne(() => Recipe, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipeId' })
  recipe!: Recipe;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 1 })
  servings!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
