import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ContentCheckService } from './content.service';
import { ContentController } from './content.controller';

@Module({
  imports: [PassportModule],
  controllers: [ContentController],
  providers: [ContentCheckService],
  exports: [ContentCheckService],
})
export class ContentModule {}
