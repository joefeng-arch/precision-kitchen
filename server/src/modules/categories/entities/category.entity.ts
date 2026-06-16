import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CategoryType = 'recipe' | 'ingredient' | 'meal_scene';

@Entity('categories')
// 用 (type, ownerId, name) 联合唯一：同一用户下不能重名；不同用户/系统之间互不冲突
@Index(['type', 'ownerId', 'name'], { unique: true })
export class Category {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 16 })
  type!: CategoryType;

  @Column({ type: 'varchar', length: 32 })
  name!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  icon!: string | null;

  @Column({ type: 'int', default: 0 })
  sort!: number;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  // 用户自建分类：ownerId = 创建人 uuid；系统分类 ownerId = null。
  // 仅作者本人能编辑/删除自己的分类（admin 可全权管理）。
  @Column({ type: 'uuid', nullable: true })
  ownerId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
