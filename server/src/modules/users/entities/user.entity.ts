import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type UserRole = 'user' | 'vip';
export type UserStatus = 'active' | 'banned';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, nullable: true })
  openid!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  unionid!: string | null;

  @Column({ type: 'varchar', length: 64, default: '吃货' })
  nickname!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  avatar!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'user' })
  role!: UserRole;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: UserStatus;

  @Column({ type: 'timestamptz', nullable: true })
  vipExpiresAt!: Date | null;

  // 烹饪完成后自动扣减食材库库存。默认关闭，避免新用户被强制维护库存。
  @Column({ type: 'boolean', default: false })
  autoDeductStock!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
