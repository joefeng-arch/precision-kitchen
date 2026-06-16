import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RecipeIngredient } from './recipe-ingredient.entity';
import { RecipeStep } from './recipe-step.entity';

export type RecipeStatus = 'draft' | 'published' | 'archived';
export type Difficulty = 'easy' | 'medium' | 'hard';

@Entity('recipes')
@Index(['authorId'])
@Index(['status'])
@Index(['categoryId'])
export class Recipe {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  authorId!: string;

  @Column({ type: 'varchar', length: 128 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  coverImage!: string | null;

  @Column({ type: 'int', nullable: true })
  categoryId!: number | null;

  @Column({ type: 'int', nullable: true })
  mealSceneId!: number | null;

  @Column({ type: 'int', default: 2 })
  baseServings!: number;

  @Column({ type: 'varchar', length: 16, default: 'medium' })
  difficulty!: Difficulty;

  @Column({ type: 'int', nullable: true, comment: '总耗时分钟' })
  totalMinutes!: number | null;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status!: RecipeStatus;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  tags!: string[];

  @Column({ type: 'boolean', default: false })
  isPublic!: boolean;

  @Column({ type: 'boolean', default: false })
  isFeatured!: boolean;

  @Column({ type: 'int', default: 0 })
  viewCount!: number;

  @Column({ type: 'int', default: 0 })
  versionCount!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => RecipeIngredient, (ri) => ri.recipe, { cascade: true })
  ingredients!: RecipeIngredient[];

  @OneToMany(() => RecipeStep, (rs) => rs.recipe, { cascade: true })
  steps!: RecipeStep[];
}
