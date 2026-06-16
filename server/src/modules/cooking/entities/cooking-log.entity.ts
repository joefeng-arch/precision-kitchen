import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CookingLogCost } from './cooking-log-cost.entity';

@Entity('cooking_logs')
@Index(['userId', 'cookedAt'])
@Index(['recipeId'])
export class CookingLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  recipeId!: string;

  @Column({ type: 'varchar', length: 128 })
  recipeTitle!: string;

  @Column({ type: 'decimal', precision: 6, scale: 2 })
  servings!: string;

  @Column({ type: 'int', nullable: true, comment: '实际耗时（分钟）' })
  durationMinutes!: number | null;

  @Column({ type: 'int', nullable: true, comment: '1-5' })
  rating!: number | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  notes!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: '0.00' })
  totalCost!: string;

  @Column({ type: 'varchar', length: 16, default: 'CNY' })
  currency!: string;

  @Column({ type: 'timestamptz' })
  cookedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => CookingLogCost, (c) => c.log, { cascade: true })
  costs!: CookingLogCost[];
}
