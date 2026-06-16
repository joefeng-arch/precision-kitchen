import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AdminRole = 'admin' | 'super_admin';

@Entity('admin_users')
export class AdminUser {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  username!: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  nickname!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'admin' })
  role!: AdminRole;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_login_at' })
  lastLoginAt!: Date | null;

  /** 首次登录后强制修改密码（seed 创建的账号默认为 true） */
  @Column({ type: 'boolean', default: true, name: 'must_change_password' })
  mustChangePassword!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
