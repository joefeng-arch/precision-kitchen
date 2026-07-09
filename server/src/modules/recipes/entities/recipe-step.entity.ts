import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Recipe } from './recipe.entity';

@Entity('recipe_steps')
@Index(['recipeId'])
export class RecipeStep {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  recipeId!: string;

  @ManyToOne(() => Recipe, (r) => r.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipeId' })
  recipe!: Recipe;

  @Column({ type: 'int' })
  stepNumber!: number;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  imageUrl!: string | null;

  @Column({ type: 'int', nullable: true, comment: '此步骤计时秒数（可选）' })
  durationSeconds!: number | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  tips!: string | null;

  @Column({
    type: 'varchar',
    length: 256,
    nullable: true,
    comment: '失败关键提醒（比 tips 高一级），与 tips 可并存',
  })
  warning!: string | null;
}
