import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ingredients')
@Index(['name'], { unique: true })
export class Ingredient {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 64 })
  name!: string;

  @Column({ type: 'int', nullable: true })
  categoryId!: number | null;

  @Column({ type: 'varchar', length: 16, default: 'g' })
  defaultUnit!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  referencePrice!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  referenceUnit!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  imageUrl!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'linear' })
  defaultScaleType!: 'linear' | 'sub_linear' | 'fixed';

  /** 别名列表，如 ["土豆","洋芋"] */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  aliases!: string[];

  /** 每 100g 热量 (kcal)，可为空 */
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  calories!: string | null;

  @Column({ type: 'int', default: 0 })
  sort!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
