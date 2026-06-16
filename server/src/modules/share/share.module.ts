import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShareCode } from './entities/share-code.entity';
import { Recipe } from '../recipes/entities/recipe.entity';
import { ShareService } from './share.service';
import { ShareController } from './share.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ShareCode, Recipe])],
  controllers: [ShareController],
  providers: [ShareService],
  exports: [ShareService],
})
export class ShareModule {}
