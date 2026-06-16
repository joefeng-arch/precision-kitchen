import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('share_codes')
export class ShareCode {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  shortCode!: string;

  @Index()
  @Column({ type: 'uuid' })
  recipeId!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  qrcodeUrl!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
