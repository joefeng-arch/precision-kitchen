import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('favorites')
@Index(['userId', 'recipeId'], { unique: true })
@Index(['userId'])
export class Favorite {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  recipeId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
