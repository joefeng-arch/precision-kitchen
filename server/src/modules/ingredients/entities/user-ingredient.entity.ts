import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_ingredients')
@Index(['userId', 'ingredientId'])
@Index(['userId', 'customName'])
export class UserIngredient {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'int', nullable: true })
  ingredientId!: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  customName!: string | null;

  // canonical 单位下的单价通常很小（如 ¥0.0252/g），需要 4 位小数精度
  @Column({ type: 'decimal', precision: 12, scale: 4 })
  unitPrice!: string;

  @Column({ type: 'varchar', length: 16 })
  priceUnit!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  stockAmount!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  stockUnit!: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  notes!: string | null;

  // 保质期：批次的过期日期。null = 未填
  @Column({ type: 'date', nullable: true })
  expiryDate!: string | null;

  // 储存方式：room_temp 常温 / refrigerated 冷藏 / frozen 冷冻。null = 未指定
  @Column({ type: 'varchar', length: 16, nullable: true })
  storageType!: 'room_temp' | 'refrigerated' | 'frozen' | null;

  // 用户在入库时选择的食材分类（references categories.id where type='ingredient'）
  @Column({ type: 'int', nullable: true })
  categoryId!: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
