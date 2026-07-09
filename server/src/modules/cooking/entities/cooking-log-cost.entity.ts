import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CookingLog } from './cooking-log.entity';

export type CostSource = 'user_lib' | 'public_lib' | 'unknown';

@Entity('cooking_log_costs')
@Index(['logId'])
export class CookingLogCost {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  logId!: string;

  @ManyToOne(() => CookingLog, (l) => l.costs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'logId' })
  log!: CookingLog;

  @Column({ type: 'int', nullable: true })
  ingredientId!: number | null;

  @Column({ type: 'varchar', length: 64 })
  name!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 16 })
  unit!: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  unitPrice!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  priceUnit!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: '0.00' })
  totalCost!: string;

  @Column({ type: 'varchar', length: 16, default: 'unknown' })
  source!: CostSource;
}
